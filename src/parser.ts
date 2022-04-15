// LabelPlusFX TransFile Reader
/// <reference path="legacy.d.ts" />

namespace LabelPlus {

    export type LPGroup = string
    export type LPLabel = {
        x: number;
        y: number;
        text: string;
        groupName: string;
    }
    export type LPTransMap = {
        [key: string]: LPLabel[]
    }
    export type LPFile = {
        path: string;
        groupList: string[];
        transMap: LPTransMap;
    }

    type MeoLabel = {
        groupId: number;
        index: number;
        text: string
        x: number;
        y: number;
    }
    type MeoGroup = {
        color: string;
        name: string;
    }
    type MeoFile = {
        version: number[];
        comment: string;
        groupList: MeoGroup[],
        transMap: {
            [key: string]: MeoLabel[]
        }
    }

    const PIC_START = ">>>>>>>>["
    const PIC_END = "]<<<<<<<<"
    const LABEL_START = "----------------["
    const LABEL_END = "]----------------"
    const PROP_START = "["
    const PROP_END = "]"
    const SPLIT = ","
    const SEPARATOR = "-"

    function meo2lp(path: string, meoFile: MeoFile): LPFile {

        let groupList: LPGroup[] = [];
        for (let i = 0; i < meoFile.groupList.length; i++) {
            groupList.push(meoFile.groupList[i].name);
        }

        let transMap: LPTransMap = {};

        for (let picName in meoFile.transMap) {
            let labels: LPLabel[] = [];
            for (let label of meoFile.transMap[picName]) {
                let l: LPLabel = {
                    x: label.x,
                    y: label.y,
                    groupName: groupList[label.groupId],
                    text: label.text.replace(" ", "\n"),
                }
                labels.push(l);
            }
            transMap[picName] = labels;
        }

        return {
            path: path,
            groupList: groupList,
            transMap: transMap
        };
    }

    function parseMeoFile(path: string): LPFile | null {
        const f = new File(path);
        if (!f || !f.exists) {
            err("LabelPlusFXJsonReader: file " + path + " not exists");
            return null;
        }

        f.open("r", "TEXT", "????");
        f.lineFeed = "unix";
        f.encoding = "UTF-8";

        const data = json(f.read()) as MeoFile

        f.close();

        return meo2lp(path, data)
    }

    function parseLPFile(path: string): LPFile | null {
        const f = new File(path);
        if (!f || !f.exists) {
            err("LabelPlusFXTextReader: file " + path + " not exists");
            return null;
        }

        f.open("r", "TEXT", "????");
        f.lineFeed = "unix";
        f.encoding = 'UTF-8';

        const lines = f.read().split("\n")
        const size = lines.length

        f.close()

        let pointer = 0

        function parseText(marks: string[]): string {
            let str = "";

            while (pointer < size) {
                for (let mark of marks) {
                    if (startsWith(lines[pointer], mark)) {
                        // return when read stop mark
                        return str.replace(RegExp("\n+"), "\n").trim()
                    }
                }
                str += lines[pointer]
                str += "\n"
                pointer++
            }

            // return when eof
            return str.replace(RegExp("\n+"), "\n").trim()
        }
        function parseTransLabel(): MeoLabel {
            const s = lines[pointer].split(LABEL_END)
            const props = s[1].replace(PROP_START, "").replace(PROP_END, "").split(SPLIT)

            const index = parseInt(s[0].replace(LABEL_START, "").trim())
            const x = parseFloat(props[0].trim())
            const y = parseFloat(props[1].trim())
            const groupId = parseInt(props[2].trim()) - 1

            pointer++
            return {
                groupId: groupId,
                index: index,
                text: parseText([PIC_START, LABEL_START]),
                x: x,
                y: y,
            }
        }
        function parsePicHead(): string {
            const picName = lines[pointer].replace(PIC_START, "").replace(PIC_END, "")
            pointer++

            return picName
        }
        function parsePicBody(): MeoLabel[] {
            const labels: MeoLabel[] = [];

            while (pointer < size && startsWith(lines[pointer], LABEL_START)) {
                labels.push(parseTransLabel())
            }

            // move to next pic
            while (pointer < size && !startsWith(lines[pointer], PIC_START)) {
                pointer++
            }

            return labels
        }

        // Version
        const v = lines[pointer].split(SPLIT)
        const version = [parseInt(v[0].trim()), parseInt(v[1].trim())]
        pointer++

        // Separator
        pointer++

        // GroupInfo Info and a Separator
        let groupCount = 1
        const groupList: MeoGroup[] = []
        while (lines[pointer] != SEPARATOR && groupCount < 10) {
            groupList.push({
                color: "000000",
                name: lines[pointer]
            })

            groupCount++
            pointer++
        }
        pointer++

        // Comment
        const comment = parseText([PIC_START])

        // Content
        const transMap = {}
        while (pointer < size && startsWith(lines[pointer], PIC_START)) {
            const picName = parsePicHead()
            transMap[picName] = parsePicBody()
        }

        const transFile: MeoFile = {
            version: version,
            comment: comment,
            groupList: groupList,
            transMap: transMap
        }

        return meo2lp(path, transFile)
    }

    export function parseTransFile(path: string): LPFile | null {
        if (path.substring(path.lastIndexOf("."), path.length) == '.json') return parseMeoFile(path)
        if (path.substring(path.lastIndexOf("."), path.length) == '.txt') return parseLPFile(path)
        return null
    }
}
