/// <reference path="legacy.d.ts" />
/// <reference path="options.ts" />
/// <reference path="common.ts" />
/// <reference path="parser.ts" />

namespace LabelPlus {

    type GroupSetInfo = {
        layerSet?: LayerSet;
        template?: ArtLayer;
    }
    type GroupSetDict = {
        [key: string]: GroupSetInfo
    }
    type LabelInfo = {
        index: number;
        x    : number;
        y    : number;
        text : string;
        group: string;
    }

    type ImageWorkspace = {
        document: Document;
        groupList: GroupSetDict;
        backgroundLayer: ArtLayer;
        textTemplateLayer: ArtLayer;
        dialogOverlayLayer: ArtLayer;
        pendingDeleteLayerList: ArtLayer[];
    }
    type ImageInfo = {
        workspace: ImageWorkspace;
        matched: string;
        origin: string;
        labels: LPLabel[];
    }

    type TextReplaceInfo = {
        from: string;
        to: string;
    }
    type TextInputOptions = {
        // undefined indicates not set
        // Note: Settings' priority is higher than template
        template   ?: ArtLayer; // Text Layer Template
        font       ?: string;
        size       ?: UnitValue;
        direction  ?: Direction;
        layerGroup ?: LayerSet;
        lending    ?: number;   // Auto Line-Lending
    }

    function parseTextReplace(str: string): TextReplaceInfo[] | null {
        let arr: TextReplaceInfo[] = [];

        let rawInfos = str.split('|');
        if (!rawInfos) return null; //解析失败

        for (let i = 0; i < rawInfos.length; i++) {
            if (isBlank(rawInfos[i])) continue;

            let raws = rawInfos[i].split("->");
            if (raws.length != 2 || isEmpty(raws[0])) return null; //解析失败

            arr.push({from: raws[0], to: raws[1]});
        }
        return arr;
    }

    // global var
    let options: ScriptOptions;
    let textReplace: TextReplaceInfo[] = [];

    function createText(document: Document, text: string, x: number, y: number, textOpts: TextInputOptions = {}): ArtLayer {
        let artLayerRef: ArtLayer;
        let textItemRef: TextItem;

        // 从模板创建，可以保证图层的所有格式与模板一致
        if (textOpts.template) {
            /// @ts-ignore ts声明文件有误，duplicate()返回ArtLayer对象，而不是void
            artLayerRef = textOpts.template.duplicate() as ArtLayer;
            textItemRef = artLayerRef.textItem;
        } else {
            artLayerRef = document.artLayers.add();
            artLayerRef.kind = LayerKind.TEXT;
            textItemRef = artLayerRef.textItem;
        }

        if (textOpts.size) textItemRef.size = textOpts.size;
        if (textOpts.font) textItemRef.font = textOpts.font;
        if (textOpts.direction) textItemRef.direction = textOpts.direction;

        textItemRef.position = Array(UnitValue(document.width.as("px") * x, "px"), UnitValue(document.height.as("px") * y, "px"));

        if (textOpts.layerGroup) {
            artLayerRef.move(textOpts.layerGroup, ElementPlacement.PLACEATBEGINNING);
        }

        if (textOpts.lending && textOpts.lending != 0) {
            textItemRef.useAutoLeading = true;
            textItemRef.autoLeadingAmount = textOpts.lending;
        }

        artLayerRef.name = text;
        textItemRef.contents = text;

        return artLayerRef;
    }
    function importLabel(image: ImageInfo, label: LabelInfo): boolean {
        // import the index of the Label
        if (options.outputLabelIndex) {
            let textInputOptions: TextInputOptions = {
                template: image.workspace.textTemplateLayer,
                font: "Arial",
                size: (options.fontSize !== 0) ? UnitValue(options.fontSize, "pt") : undefined,
                direction: Direction.HORIZONTAL,
                layerGroup: image.workspace.groupList["_Label"].layerSet,
            };
            createText(image.workspace.document, String(label.index), label.x, label.y, textInputOptions);
        }

        // Replace text
        if (options.textReplace) {
            for (let i = 0; i < textReplace.length; i++) {
                while (label.text.indexOf(textReplace[i].from) != -1) {
                    label.text = label.text.replace(textReplace[i].from, textReplace[i].to);
                }
            }
        }

        // Setup input options
        let textInputOptions: TextInputOptions = {
            template: image.workspace.groupList[label.group].template,
            font: isBlank(options.font) ? options.font : undefined,
            layerGroup: image.workspace.groupList[label.group].layerSet,
            lending: options.textLeading ? options.textLeading : undefined,
        };
        // Choose text direction
        switch (options.textDirection) {
            case OptionTextDirection.KEEP:
                textInputOptions.direction = undefined;
                break;
            case OptionTextDirection.HORIZONTAL:
                textInputOptions.direction = Direction.HORIZONTAL;
                break;
            case OptionTextDirection.VERTICAL:
                textInputOptions.direction = Direction.VERTICAL;
                break;
        }
        // Set font size
        if (options.docTemplate === OptionDocTemplate.NO) {
            // If user do not use template, set to proper size
            let properSize = UnitValue(min(image.workspace.document.width.as("pt"), image.workspace.document.height.as("pt")) / 90.0, "pt");
            textInputOptions.size = (options.fontSize !== 0) ? UnitValue(options.fontSize, "pt") : properSize;
        } else {
            // If user use template, let it undefined
            textInputOptions.size = (options.fontSize !== 0) ? UnitValue(options.fontSize, "pt") : undefined;
        }

        let textLayer: ArtLayer = createText(image.workspace.document, label.text, label.x, label.y, textInputOptions);

        // Run post-import action
        if (options.actionGroup) {
            image.workspace.document.activeLayer = textLayer;
            let result = doAction(label.group, options.actionGroup);
            log("run action " + label.group + "[" + options.actionGroup + "]..." + result ? "done" : "fail");
        }

        return true;
    }
    function importImage(image: ImageInfo): boolean {
        // Run action _start
        if (options.actionGroup) {
            image.workspace.document.activeLayer = image.workspace.document.layers[image.workspace.document.layers.length - 1];
            let result = doAction("_start", options.actionGroup);
            log("run action _start[" + options.actionGroup + "]..." + result ? "done" : "fail");
        }

        // todo: figure out whether preserve this procedure
        // 找出需要涂白的标签,记录他们的坐标,执行涂白
        if (options.dialogOverlayLabelGroups) {
            let points: {x: number, y: number}[] = [];
            let groups = options.dialogOverlayLabelGroups.split(",");
            for (let j = 0; j < image.labels.length; j++) {
                const label = image.labels[j];
                if (groups.indexOf(label.groupName) >= 0) {
                    points.push({x: label.x, y: label.y});
                }
            }
            log("do lp_dialogClear: " + points);
            MyAction.lp_dialogClear(points, image.workspace.document.width, image.workspace.document.height, 16, 1, image.workspace.dialogOverlayLayer);
            delArrayElement<ArtLayer>(image.workspace.pendingDeleteLayerList, image.workspace.dialogOverlayLayer); // do not delete dialog-overlay-layer
        }

        for (let i = 0; i < image.labels.length; i++) {
            const label = image.labels[i];

            // the groupName did not select by user, return directly
            if (options.groupSelected.indexOf(label.groupName) == -1) continue;

            const labelInfo: LabelInfo = {
                index: i + 1,
                x: label.x,
                y: label.y,
                group: label.groupName,
                text: label.text,
            };
            log("import label " + labelInfo.index + "...");
            importLabel(image, labelInfo);
        }

        // Adjust layer order
        if (image.workspace.backgroundLayer && (options.dialogOverlayLabelGroups !== "")) {
            log('move "dialog-overlay" before "bg"');
            image.workspace.dialogOverlayLayer.move(image.workspace.backgroundLayer, ElementPlacement.PLACEBEFORE);
        }

        // Remove unnecessary Layer & LayerSet
        log('remove unnecessary Layer/LayerSet...');
        for (const layer of image.workspace.pendingDeleteLayerList) {
            layer.remove();
        }
        for (const groupName in image.workspace.groupList) {
            if (image.workspace.groupList[groupName]?.layerSet?.artLayers.length === 0) {
                image.workspace.groupList[groupName]?.layerSet?.remove();
            }
        }

        // Run action _end
        if (options.actionGroup) {
            image.workspace.document.activeLayer = image.workspace.document.layers[image.workspace.document.layers.length - 1];
            let result = doAction("_end", options.actionGroup);
            log("run action _end[" + options.actionGroup + "]..." + result ? "done" : "fail");
        }

        return true;
    }

    function prepareWorkspace(imageName: string, templatePath: string): ImageWorkspace | null {
        // open background image
        let backgroundDocument: Document;
        try {
            backgroundDocument = app.open(new File(options.source + DIR_SEPARATOR + imageName));
        } catch {
            // Note: do not exit if image not exist
            return null;
        }

        let workspaceDocument: Document; // workspace document
        if (options.docTemplate == OptionDocTemplate.NO) {
            // Disabled, create a new document
            workspaceDocument = app.documents.add(backgroundDocument.width, backgroundDocument.height, backgroundDocument.resolution, backgroundDocument.name, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
            workspaceDocument.activeLayer.name = TEMPLATE_LAYER.IMAGE;
        } else {
            // Note: must crash if template do not exist
            workspaceDocument = app.open(new File(templatePath));
            workspaceDocument.resizeImage(undefined, undefined, backgroundDocument.resolution);
            workspaceDocument.resizeCanvas(backgroundDocument.width, backgroundDocument.height);
        }

        // Workspace document is clean, check template elements, if an element not exist
        let backgroundLayer: ArtLayer;
        let textTemplateLayer: ArtLayer;
        let dialogOverlayLayer: ArtLayer;
        let pendingDelLayerList: ArtLayer[] = [];
        {
            // add all artLayers to the pending delete list
            for (let i = 0; i < workspaceDocument.artLayers.length; i++) {
                let layer: ArtLayer = workspaceDocument.artLayers[i];
                pendingDelLayerList.push(layer);
            }

            // bg layer template
            try {
                backgroundLayer = workspaceDocument.artLayers.getByName(TEMPLATE_LAYER.IMAGE);
            } catch {
                backgroundLayer = workspaceDocument.artLayers.add();
                backgroundLayer.name = TEMPLATE_LAYER.DIALOG_OVERLAY; // todo: why dialog_overlay
            }
            // text layer template
            try {
                textTemplateLayer = workspaceDocument.artLayers.getByName(TEMPLATE_LAYER.TEXT);
            } catch {
                textTemplateLayer = workspaceDocument.artLayers.add();
                textTemplateLayer.name = TEMPLATE_LAYER.TEXT;
                pendingDelLayerList.push(textTemplateLayer); // pending delete
            }
            // dialog overlay layer template
            try {
                dialogOverlayLayer = workspaceDocument.artLayers.getByName(TEMPLATE_LAYER.DIALOG_OVERLAY);
            } catch {
                dialogOverlayLayer = workspaceDocument.artLayers.add();
                dialogOverlayLayer.name = TEMPLATE_LAYER.DIALOG_OVERLAY;
            }
        }

        // Import background doc to workspace doc:
        // If bgDoc has only one layer, select all and copy to bg layer. (apply bg layer template)
        // If bgDoc has multi layers, move all layers after bg layer. (bg layer template is invalid)
        // Note: copy will occupy the clipboard
        if (backgroundDocument.artLayers.length == 1 && backgroundDocument.layerSets.length == 0) {
            app.activeDocument = backgroundDocument;
            backgroundDocument.selection.selectAll();
            backgroundDocument.selection.copy();
            app.activeDocument = workspaceDocument;
            workspaceDocument.activeLayer = backgroundLayer;
            workspaceDocument.paste();
            delArrayElement<ArtLayer>(pendingDelLayerList, backgroundLayer); // keep bg layer
        } else {
            app.activeDocument = backgroundDocument;
            let item = backgroundLayer;
            for (let i = 0; i < backgroundDocument.layers.length; i++) {
                item = backgroundDocument.layers[i].duplicate(item, ElementPlacement.PLACEAFTER);
            }
        }
        backgroundDocument.close(SaveOptions.DONOTSAVECHANGES);

        if (workspaceDocument.mode == DocumentMode.INDEXEDCOLOR) {
            log("wsDoc.mode is IndexedColor, set to RGB");
            workspaceDocument.changeMode(ChangeMode.RGB);
        }

        // Note: No need to change GreyScale Mode
        // if (workspaceDocument.mode == DocumentMode.GRAYSCALE) {
        //    log("wsDoc.mode is GreyScale, set to RGB")
        //    workspaceDocument.changeMode(ChangeMode.RGB)
        // }

        // Create Groups (ArtLayerSet)
        let groups: GroupSetDict = {};
        for (let i = 0; i < options.groupSelected.length; i++) {
            let name = options.groupSelected[i];
            let temp: GroupSetInfo = {};

            // 创建PS中图层分组
            if (!options.noLayerGroup) {
                temp.layerSet = workspaceDocument.layerSets.add();
                temp.layerSet.name = name;
            }
            // 尝试寻找分组模板，找不到则使用默认文本模板
            if (options.docTemplate !== OptionDocTemplate.NO) {
                let textLayer: ArtLayer;
                try {
                    textLayer = workspaceDocument.artLayers.getByName(name);
                } catch {
                    textLayer = textTemplateLayer
                }
                temp.template = textLayer;
            }
            groups[name] = temp; // add
        }
        if (options.outputLabelIndex) {
            let temp: GroupSetInfo = {};
            temp.layerSet = workspaceDocument.layerSets.add();
            temp.layerSet.name = "_Label";
            groups["_Label"] = temp;
        }

        return {
            document: workspaceDocument,
            backgroundLayer: backgroundLayer,
            textTemplateLayer: textTemplateLayer,
            dialogOverlayLayer: dialogOverlayLayer,
            pendingDeleteLayerList: pendingDelLayerList,
            groupList: groups,
        };
    }
    function cleanupWorkspace(imageInfo: ImageInfo, saveType: OptionOutputType = OptionOutputType.PSD): boolean {
        let fileOut = new File(options.target + DIR_SEPARATOR + imageInfo.matched);
        let asCopy = false;
        let saveOpts: any;
        switch (saveType) {
            case OptionOutputType.PSD:
                saveOpts = new PhotoshopSaveOptions();
                break;
            case OptionOutputType.TIFF:
                saveOpts = new TiffSaveOptions();
                break;
            case OptionOutputType.PNG:
                saveOpts = new PNGSaveOptions();
                asCopy = true;
                break;
            case OptionOutputType.JPG:
                saveOpts = new JPEGSaveOptions();
                saveOpts.quality = 10;
                asCopy = true;
                break;
            default:
                err(imageInfo.origin + "(" + imageInfo.matched + "): unknown save type " + saveType);
                return false
        }

        imageInfo.workspace.document.saveAs(fileOut, saveOpts, asCopy, Extension.LOWERCASE);

        // Close
        if (!options.notClose) imageInfo.workspace.document.close(SaveOptions.DONOTSAVECHANGES);

        return true;
    }

    export function importFiles(scriptOptions: ScriptOptions): boolean {
        options = scriptOptions;

        log("Start import process!!!");
        log("Properties start ------------------");
        log(Stdlib.listProps(options));
        log("Properties end   ------------------");

        // Parse text file
        let lpFile = parseTransFile(options.lpTextFilePath);
        if (lpFile == null) {
            err("error: " + I18n.ERROR_PARSER_LPTEXT_FAIL);
            return false;
        }
        log("parse lp text done...");

        // Parse ReplaceInfo
        if (options.textReplace) {
            let temp = parseTextReplace(options.textReplace);
            if (temp === null) {
                err("error: " + I18n.ERROR_TEXT_REPLACE_EXPRESSION);
                return false;
            }
            textReplace = temp;
        }
        log("parse text replace done...");

        // Use document template
        let templatePath: string = "";
        switch (options.docTemplate) {
            case OptionDocTemplate.CUSTOM:
                templatePath = options.docTemplateCustomPath;
                if (!isFileExists(templatePath)) {
                    err("error: " + I18n.ERROR_NOT_FOUND_TEMPLATE + " " + templatePath);
                    return false;
                }
                break;
            case OptionDocTemplate.AUTO:
                let tempDir = GetScriptFolderPath() + DIR_SEPARATOR + "ps_script_res" + DIR_SEPARATOR;
                let tempFile = app.locale.split("_")[0].toLocaleLowerCase() + ".psd"; // such as "zh_CN" -> zh.psd

                let try_list: string[] = [
                    tempDir + tempFile,
                    tempDir + "en.psd"
                ];
                for (let i = 0; i < try_list.length; i++) {
                    if (isFileExists(try_list[i])) {
                        templatePath = try_list[i];
                        break;
                    }
                }
                if (templatePath === "") {
                    err("error: " + I18n.ERROR_PRESET_TEMPLATE_NOT_FOUND);
                    return false;
                }
                log("auto match template: " + templatePath);
                break;
            case OptionDocTemplate.NO:
            default:
                log("template not used");
                break;
        }

        // Import
        for (let i = 0; i < options.imageSelected.length; i++) {
            let originName: string = options.imageSelected[i].file; // 翻译文件中的图片文件名
            let matchedName: string = options.imageSelected[i].matched_file;
            let namePair = originName + "(" + matchedName + ")";

            log(namePair + 'in processing...');
            if (options.ignoreNoLabelImg && lpFile.transMap[originName].length == 0) {
                log('no label, ignored...');
                continue;
            }
            let workspace = prepareWorkspace(matchedName, templatePath);
            if (workspace == null) {
                err(namePair + ": " + I18n.ERROR_FILE_OPEN_FAIL);
                continue;
            }

            let imageInfo: ImageInfo = {
                workspace: workspace,
                matched: matchedName,
                origin: originName,
                labels: lpFile.transMap[originName],
            };
            if (!importImage(imageInfo)) err(namePair + ": import label failed");
            if (!cleanupWorkspace(imageInfo, options.outputType)) err(namePair + ": " + I18n.ERROR_FILE_SAVE_FAIL);

            log(namePair + ": done");
        }
        log("All Done!");
        return true;
    }

}
