/// <reference path="legacy.d.ts" />

namespace LabelPlus {

    export enum OptionTextDirection { KEEP, HORIZONTAL, VERTICAL }
    export enum OptionDocTemplate { AUTO, NO, CUSTOM}
    export enum OptionOutputType { PSD, TIFF, PNG, JPG, _count }

    export class ImageInfo {
        file: string = "";
        matched_file: string = "";
        index: number = 0;
    }

    export class ScriptOptions {

        // --------------- not save options --------------- //
        source:         string      = ""; // transMap source folder
        target:         string      = ""; // transMap target folder
        lpTextFilePath: string      = ""; // path of label plus text file
        imageSelected:  ImageInfo[] = []; // selected transMap
        groupSelected:  string[]    = []; // selected label groupName

        // --------------- saved options --------------- //
        docTemplate: OptionDocTemplate = OptionDocTemplate.AUTO; // image document template option
        docTemplateCustomPath: string = ""; // custom image document template path

        outputType: OptionOutputType = OptionOutputType.PSD; // output image file type
        ignoreNoLabelImg: boolean = false; // ignore transMap with no label
        noLayerGroup:     boolean = false; // do not create groupName in document for text layers
        notClose:         boolean = false; // do not close image document

        font:             string  = "";    // set font if it is not empty
        fontSize:         number  = 0;     // set font size if neq 0
        textLeading:      number  = 0;     // set auto leading value if neq 0, unit is percent
        textReplace:      string  = "";    // run text replacing function, if the expression is not empty
        outputLabelIndex: boolean = false; // if true, output label index as text layer
        textDirection: OptionTextDirection = OptionTextDirection.KEEP; // text direction option

        actionGroup:              string = ""; // action groupName name
        dialogOverlayLabelGroups: string = ""; // the label groupList need dialog overlay layer, split by ","
    }

}
