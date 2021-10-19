/// <reference path="legacy.d.ts" />
/// <reference path="options.ts" />
/// <reference path="common.ts" />
/// <reference path="parser.ts" />

namespace LabelPlus {

    type GroupInfo = {
        layerSet?: LayerSet;
        template?: ArtLayer;
    }
    type GroupDict = {
        [key: string]: GroupInfo
    }

    type LabelInfo = {
        index    : number;
        x        : number;
        y        : number;
        text     : string;
        groupName: string;
    }

    type Point = {
        x: number,
        y: number
    }

    type ImageWorkspace = {
        document           : Document;
        groupList          : GroupDict;
        backgroundLayer    : ArtLayer;
        textTemplateLayer  : ArtLayer;
        dialogOverlayLayer : ArtLayer;
        pendingDelLayerList: ArtLayer[];
    }
    type ImageInfo = {
        ws       : ImageWorkspace;
        name     : string;
        name_pair: string;
        labels   : LPLabel[];
    }

    // 文本导入选项，参数为undefined时表示不设置该项
    type TextInputOptions = {
        template   ?: ArtLayer; // 文本图层模板
        font       ?: string;
        size       ?: UnitValue;
        direction  ?: Direction;
        layerGroup ?: LayerSet;
        lending    ?: number;   // 自动行距
    }

    // 文本替换表达式解析
    type TextReplaceInfo = {
        from: string;
        to: string;
    }
    function textReplaceReader(str: string): TextReplaceInfo[] | null {
        let arr: TextReplaceInfo[] = [];

        let strings1 = str.split('|');
        if (!strings1)
            return null; //解析失败

        for (let i = 0; i < strings1.length; i++) {
            if (strings1[i] === "")
                continue;

            let strings2 = strings1[i].split("->");
            if ((strings2.length != 2) || (strings2[0] == ""))
                return null; //解析失败

            arr.push({from: strings2[0], to: strings2[1]});
        }
        return arr;
    }

    // global var
    let options: ScriptOptions | null = null;
    let textReplace: TextReplaceInfo[] = [];

    function importLabel(image: ImageInfo, label: LabelInfo): boolean {
        assert(options !== null);

        // import the index of the Label
        if (options.outputLabelIndex) {
            let o: TextInputOptions = {
                template: image.ws.textTemplateLayer,
                font: "Arial",
                size: (options.fontSize !== 0) ? UnitValue(options.fontSize, "pt") : undefined,
                direction: Direction.HORIZONTAL,
                layerGroup: image.ws.groupList["_Label"].layerSet,
            };
            newTextLayer(image.ws.document, String(label.index), label.x, label.y, o);
        }

        // 替换文本
        if (options.textReplace) {
            for (let k = 0; k < textReplace.length; k++) {
                while (label.text.indexOf(textReplace[k].from) != -1) {
                    label.text = label.text.replace(textReplace[k].from, textReplace[k].to);
                }
            }
        }

        // 确定文字方向
        let textDirection: Direction | undefined;
        switch (options.textDirection) {
            case OptionTextDirection.KEEP:
                textDirection = undefined;
                break;
            case OptionTextDirection.HORIZONTAL:
                textDirection = Direction.HORIZONTAL;
                break;
            case OptionTextDirection.VERTICAL:
                textDirection = Direction.VERTICAL;
                break;
        }

        // 导出文本，设置的优先级大于模板，无模板时做部分额外处理
        let textLayer: ArtLayer;
        let o: TextInputOptions = {
            template: image.ws.groupList[label.groupName].template,
            font: (options.font != "") ? options.font : undefined,
            direction: textDirection,
            layerGroup: image.ws.groupList[label.groupName].layerSet,
            lending: options.textLeading ? options.textLeading : undefined,
        };

        // 使用模板时，用户不设置字体大小，不做更改；不使用模板时，如果用户不设置大小，自动调整到合适的大小
        if (options.docTemplate === OptionDocTemplate.NO) {
            let proper_size = UnitValue(min(image.ws.document.height.as("pt"), image.ws.document.height.as("pt")) / 90.0, "pt");
            o.size = (options.fontSize !== 0) ? UnitValue(options.fontSize, "pt") : proper_size;
        } else {
            o.size = (options.fontSize !== 0) ? UnitValue(options.fontSize, "pt") : undefined;
        }
        textLayer = newTextLayer(image.ws.document, label.text, label.x, label.y, o);

        // 执行动作,名称为分组名
        if (options.actionGroup) {
            image.ws.document.activeLayer = textLayer;
            let result = doAction(label.groupName, options.actionGroup);
            log("run action " + label.groupName + "[" + options.actionGroup + "]..." + result ? "done" : "fail");
        }
        return true;
    }

    function importImage(image: ImageInfo): boolean {
        assert(options !== null);

        // run action _start
        if (options.actionGroup) {
            image.ws.document.activeLayer = image.ws.document.layers[image.ws.document.layers.length - 1];
            let result = doAction("_start", options.actionGroup);
            log("run action _start[" + options.actionGroup + "]..." + result ? "done" : "fail");
        }

        // 找出需要涂白的标签,记录他们的坐标,执行涂白
        if (options.dialogOverlayLabelGroups) {
            let points: Point[] = [];
            let groups = options.dialogOverlayLabelGroups.split(",");
            for (let j = 0; j < image.labels.length; j++) {
                const label = image.labels[j];
                if (groups.indexOf(label.groupName) >= 0) {
                    points.push({x: label.x, y: label.y});
                }
            }
            log("do lp_dialogClear: " + points);
            MyAction.lp_dialogClear(points, image.ws.document.width, image.ws.document.height, 16, 1, image.ws.dialogOverlayLayer);
            delArrayElement<ArtLayer>(image.ws.pendingDelLayerList, image.ws.dialogOverlayLayer); // do not delete dialog-overlay-layer
        }

        // 遍历LabelData
        for (let j = 0; j < image.labels.length; j++) {
            const l = image.labels[j];

            // the groupName did not select by user, return directly
            if (options.groupSelected.indexOf(l.groupName) == -1) continue;

            const label_info: LabelInfo = {
                index: j + 1,
                x: l.x,
                y: l.y,
                groupName: l.groupName,
                text: l.text,
            };
            log("import label " + label_info.index + "...");
            importLabel(image, label_info);
        }

        // adjust layer order
        if (image.ws.backgroundLayer && (options.dialogOverlayLabelGroups !== "")) {
            log('move "dialog-overlay" before "bg"');
            image.ws.dialogOverlayLayer.move(image.ws.backgroundLayer, ElementPlacement.PLACEBEFORE);
        }

        // remove unnecessary Layer/LayerSet
        log('remove unnecessary Layer/LayerSet...');
        for (const layer of image.ws.pendingDelLayerList) { // Layer
            layer.remove();
        }
        for (const k in image.ws.groupList) { // LayerSet
            if (image.ws.groupList[k].layerSet !== undefined) {
                if (image.ws.groupList[k].layerSet?.artLayers.length === 0) {
                    image.ws.groupList[k].layerSet?.remove();
                }
            }
        }

        // run action _end
        if (options.actionGroup) {
            image.ws.document.activeLayer = image.ws.document.layers[image.ws.document.layers.length - 1];
            let result = doAction("_end", options.actionGroup);
            log("run action _end[" + options.actionGroup + "]..." + result ? "done" : "fail");
        }
        return true;
    }

    function openImageWorkspace(img_filename: string, template_path: string): ImageWorkspace | null {
        assert(options !== null);

        // open background image
        let bgDoc: Document;
        try {
            let bgFile = new File(options.source + DIR_SEPARATOR + img_filename);
            bgDoc = app.open(bgFile);
        } catch {
            return null; //note: do not exit if image not exist
        }

        // if template is enabled, open template; or create a new file
        let wsDoc: Document; // workspace document
        if (options.docTemplate == OptionDocTemplate.NO) {
            wsDoc = app.documents.add(bgDoc.width, bgDoc.height, bgDoc.resolution, bgDoc.name, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
            wsDoc.activeLayer.name = TEMPLATE_LAYER.IMAGE;
        } else {
            let docFile = new File(template_path);  //note: if template must do not exist, crash
            wsDoc = app.open(docFile);
            wsDoc.resizeImage(undefined, undefined, bgDoc.resolution);
            wsDoc.resizeCanvas(bgDoc.width, bgDoc.height);
        }

        // wsDoc is clean, check template elements, if a element not exist
        let bgLayer: ArtLayer;
        let textTemplateLayer: ArtLayer;
        let dialogOverlayLayer: ArtLayer;
        let pendingDelLayerList: ArtLayer[] = [];
        {
            // add all artLayers to the pending delete list
            for (let i = 0; i < wsDoc.artLayers.length; i++) {
                let layer: ArtLayer = wsDoc.artLayers[i];
                pendingDelLayerList.push(layer);
            }

            // bg layer template
            try {
                bgLayer = wsDoc.artLayers.getByName(TEMPLATE_LAYER.IMAGE);
            } catch {
                bgLayer = wsDoc.artLayers.add();
                bgLayer.name = TEMPLATE_LAYER.DIALOG_OVERLAY;
            }
            // text layer template
            try {
                textTemplateLayer = wsDoc.artLayers.getByName(TEMPLATE_LAYER.TEXT);
            } catch {
                textTemplateLayer = wsDoc.artLayers.add();
                textTemplateLayer.name = TEMPLATE_LAYER.TEXT;
                pendingDelLayerList.push(textTemplateLayer); // pending delete
            }
            // dialog overlay layer template
            try {
                dialogOverlayLayer = wsDoc.artLayers.getByName(TEMPLATE_LAYER.DIALOG_OVERLAY);
            } catch {
                dialogOverlayLayer = wsDoc.artLayers.add();
                dialogOverlayLayer.name = TEMPLATE_LAYER.DIALOG_OVERLAY;
            }
        }

        // import bgDoc to wsDoc:
        // if bgDoc has only a layer, select all and copy to bg layer, for applying bg layer template
        // if bgDoc has multiple layers, move all layers after bg layer (bg layer template is invalid)
        if ((bgDoc.artLayers.length == 1) && (bgDoc.layerSets.length == 0)) {
            app.activeDocument = bgDoc;
            bgDoc.selection.selectAll();
            bgDoc.selection.copy();
            app.activeDocument = wsDoc;
            wsDoc.activeLayer = bgLayer;
            wsDoc.paste();
            delArrayElement<ArtLayer>(pendingDelLayerList, bgLayer); // keep bg layer
        } else {
            app.activeDocument = bgDoc;
            let item = bgLayer;
            for (let i = 0; i < bgDoc.layers.length; i++) {
                item = bgDoc.layers[i].duplicate(item, ElementPlacement.PLACEAFTER);
            }
        }
        bgDoc.close(SaveOptions.DONOTSAVECHANGES);

        if (wsDoc.mode == DocumentMode.INDEXEDCOLOR) {
            // 若文档类型为索引色模式 更改为RGB模式
            log("wsDoc.mode is INDEXEDCOLOR, set RGB");
            wsDoc.changeMode(ChangeMode.RGB);
        } else if (wsDoc.mode == DocumentMode.GRAYSCALE) {
            // 若文档类型为Greyscale模式 更改为RGB模式
            log("wsDoc.mode is Greyscale, set RGB")
            wsDoc.changeMode(ChangeMode.RGB)
        }

        // 分组
        let groups: GroupDict = {};
        for (let i = 0; i < options.groupSelected.length; i++) {
            let name = options.groupSelected[i];
            let tmp: GroupInfo = {};

            // 创建PS中图层分组
            if (!options.noLayerGroup) {
                tmp.layerSet = wsDoc.layerSets.add();
                tmp.layerSet.name = name;
            }
            // 尝试寻找分组模板，找不到则使用默认文本模板
            if (options.docTemplate !== OptionDocTemplate.NO) {
                let l: ArtLayer | undefined;
                try {
                    l = wsDoc.artLayers.getByName(name);
                } catch { }
                tmp.template = (l !== undefined) ? l : textTemplateLayer;
            }
            groups[name] = tmp; // add
        }
        if (options.outputLabelIndex) {
            let tmp: GroupInfo = {};
            tmp.layerSet = wsDoc.layerSets.add();
            tmp.layerSet.name = "Label";
            groups["_Label"] = tmp;
        }

        return {
            document: wsDoc,
            backgroundLayer: bgLayer,
            textTemplateLayer: textTemplateLayer,
            dialogOverlayLayer: dialogOverlayLayer,
            pendingDelLayerList: pendingDelLayerList,
            groupList: groups,
        };
    }

    function closeImage(img: ImageInfo, saveType: OptionOutputType = OptionOutputType.PSD): boolean {
        assert(options !== null);

        // 保存文件
        let fileOut = new File(options.target + DIR_SEPARATOR + img.name);
        let asCopy = false;
        let saveOpts: any;
        switch (saveType) {
            case OptionOutputType.PSD:
                saveOpts = PhotoshopSaveOptions;
                break;
            case OptionOutputType.TIFF:
                saveOpts = TiffSaveOptions;
                break;
            case OptionOutputType.PNG:
                saveOpts = PNGSaveOptions;
                asCopy = true;
                break;
            case OptionOutputType.JPG:
                saveOpts = new JPEGSaveOptions();
                saveOpts.quality = 10;
                asCopy = true;
                break;
            default:
                err(img.name_pair + ": unknown save type " + saveType);
                return false
        }

        let extensionType = Extension.LOWERCASE;
        img.ws.document.saveAs(fileOut, saveOpts, asCopy, extensionType);

        // 关闭文件
        if (!options.notClose) img.ws.document.close(SaveOptions.DONOTSAVECHANGES);

        return true;
    }

    export function importFiles(custom_opts: ScriptOptions): boolean {
        options = custom_opts;

        log("Start import process!!!");
        log("Properties start ------------------");
        log(Stdlib.listProps(options));
        log("Properties end   ------------------");

        //解析LabelPlus文本
        let lpFile = parseTransFile(options.lpTextFilePath);
        if (lpFile == null) {
            err("error: " + I18n.ERROR_PARSER_LPTEXT_FAIL);
            return false;
        }
        log("parse lp text done...");

        // 替换文本解析
        if (options.textReplace) {
            let tmp = textReplaceReader(options.textReplace);
            if (tmp === null) {
                err("error: " + I18n.ERROR_TEXT_REPLACE_EXPRESSION);
                return false;
            }
            textReplace = tmp;
        }
        log("parse text replace done...");

        // 确定doc模板文件
        let template_path: string = "";
        switch (options.docTemplate) {
            case OptionDocTemplate.CUSTOM:
                template_path = options.docTemplateCustomPath;
                if (!isFileExists(template_path)) {
                    err("error: " + I18n.ERROR_NOT_FOUND_TEMPLATE + " " + template_path);
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
                        template_path = try_list[i];
                        break;
                    }
                }
                if (template_path === "") {
                    err("error: " + I18n.ERROR_PRESET_TEMPLATE_NOT_FOUND);
                    return false;
                }
                log("auto match template: " + template_path);
                break;
            case OptionDocTemplate.NO:
            default:
                log("template not used");
                break;
        }

        // 遍历所选图片
        for (let i = 0; i < options.imageSelected.length; i++) {
            let origin_name: string = options.imageSelected[i].file; // 翻译文件中的图片文件名
            let matched_name: string = options.imageSelected[i].matched_file;
            let name_pair = LabelPlus.FileNamePair(origin_name, matched_name);

            log(name_pair + 'in processing...');
            if (options.ignoreNoLabelImg && lpFile?.transMap[origin_name].length == 0) { // ignore img with no label
                log('no label, ignored...');
                continue;
            }
            let ws = openImageWorkspace(matched_name, template_path);
            if (ws == null) {
                err(name_pair + ": " + I18n.ERROR_FILE_OPEN_FAIL);
                continue;
            }

            let img_info: ImageInfo = {
                ws: ws,
                name: matched_name,
                name_pair: name_pair,
                labels: lpFile.transMap[origin_name],
            };
            if (!importImage(img_info)) {
                err(name_pair + ": import label failed");
            }
            if (!closeImage(img_info, options.outputType)) {
                err(name_pair + ": " + I18n.ERROR_FILE_SAVE_FAIL);
            }
            log(name_pair + ": done");
        }
        log("All Done!");
        return true;
    }

    // 创建文本图层
    function newTextLayer(doc: Document, text: string, x: number, y: number, textOpts: TextInputOptions = {}): ArtLayer {
        let artLayerRef: ArtLayer;
        let textItemRef: TextItem;

        // 从模板创建，可以保证图层的所有格式与模板一致
        if (textOpts.template) {
            /// @ts-ignore ts声明文件有误，duplicate()返回ArtLayer对象，而不是void
            artLayerRef = <ArtLayer>textOpts.template.duplicate();
            textItemRef = artLayerRef.textItem;
        } else {
            artLayerRef = doc.artLayers.add();
            artLayerRef.kind = LayerKind.TEXT;
            textItemRef = artLayerRef.textItem;
        }

        if (textOpts.size) textItemRef.size = textOpts.size;
        if (textOpts.font) textItemRef.font = textOpts.font;
        if (textOpts.direction) textItemRef.direction = textOpts.direction;

        textItemRef.position = Array(UnitValue(doc.width.as("px") * x, "px"), UnitValue(doc.height.as("px") * y, "px"));

        if (textOpts.layerGroup) {
            artLayerRef.move(textOpts.layerGroup, ElementPlacement.PLACEATBEGINNING);
        }

        if ((textOpts.lending) && (textOpts.lending != 0)) {
            textItemRef.useAutoLeading = true;
            textItemRef.autoLeadingAmount = textOpts.lending;
        }

        artLayerRef.name = text;
        textItemRef.contents = text;

        return artLayerRef;
    }

}
