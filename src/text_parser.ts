// LabelPlusFX TransFile Reader
/// <reference path="legacy.d.ts" />

namespace LabelPlus {
    export interface LpLabel {
        x: number;
        y: number;
        contents: string;
        group: string;
    }

    export type LpLabelDict = {
        [key: string]: LpLabel[]
    };

    export interface LpFile {
        path: string;
        groups: string[];
        images: LpLabelDict;
    }

    interface MeoLabel {
        groupId: number;
        index: number;
        text: string
        x: number;
        y: number;
    }

    interface MeoGroup {
        color: string;
        name: string;
    }

    interface MeoTransMap {
        [key: string]: MeoLabel[]
    }

    interface MeoFile {
        version: number[];
        comment: string;
        groupList: MeoGroup[],
        transMap: MeoTransMap
    }

    const PIC_START = ">>>>>>>>["
    const PIC_END = "]<<<<<<<<"
    const LABEL_START = "----------------["
    const LABEL_END = "]----------------"
    const PROP_START = "["
    const PROP_END = "]"
    const SPLIT = ","
    const SEPARATOR = "-"

    function startWith(str: string, head: string): boolean {
        return str.indexOf(head) === 0
    }

    function meo2lp(path: string, meoFile: MeoFile): LpFile {

        let groups: string[] = [];
        for (let i = 0; i < meoFile.groupList.length; i++) {
            groups.push(meoFile.groupList[i].name);
        }

        let label_dict: LpLabelDict = {};

        for (let picName in meoFile.transMap) {
            let labels: LpLabel[] = [];
            for (let label of meoFile.transMap[picName]) {
                let l: LpLabel = {
                    x: label.x,
                    y: label.y,
                    group: groups[label.groupId],
                    contents: label.text.replace(" ", "\n"),
                }
                labels.push(l);
            }
            label_dict[picName] = labels;
        }

        return {
            path: path,
            groups: groups,
            images: label_dict
        };
    }

    function parseMeoFile(path: string): LpFile | null {
        const f = new File(path);
        if (!f || !f.exists) {
            log_err("LabelPlusFXJsonReader: file " + path + " not exists");
            return null;
        }

        f.open("r", "TEXT", "????");
        f.lineFeed = "unix";
        f.encoding = "UTF-8";

        const meo = f.read();
        const data = (new Function('return ' + meo))();

        f.close();

        // ugly js

        return meo2lp(path, data)
    }

    // @ts-ignore
    function parseLPFile(path: string): LpFile | null {
        const f = new File(path);
        if (!f || !f.exists) {
            log_err("LabelPlusFXTextReader: file " + path + " not exists");
            return null;
        }

        // 打开
        f.open("r");
        f.lineFeed = "unix";
        f.encoding = 'UTF-8';

        const lines = f.read().split("\n")
        const size = lines.length

        f.close()

        let pointer = 0

        const parseText = (marks: string[]): string => {
            let str = "";

            while (pointer < size) {
                for (let mark of marks) {
                    if (startWith(lines[pointer], mark)) {
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
        const parseTransLabel = (): MeoLabel => {
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
        const parsePicHead = (): string => {
            const picName = lines[pointer].replace(PIC_START, "").replace(PIC_END, "")
            pointer++

            return picName
        }
        const parsePicBody = (): MeoLabel[] => {
            const labels: MeoLabel[] = [];

            while (pointer < size && startWith(lines[pointer], LABEL_START)) {
                labels.push(parseTransLabel())
            }

            // move to next pic
            while (pointer < size && !startWith(lines[pointer], PIC_START)) {
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

        // Group Info and a Separator
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
        const transMap: MeoTransMap = {}
        while (pointer < size && startWith(lines[pointer], PIC_START)) {
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

    export function parseTransFile(path: string): LpFile | null {
        if (path.substring(path.lastIndexOf("."), path.length) == '.json') return parseMeoFile(path)
        if (path.substring(path.lastIndexOf("."), path.length) == '.txt') return parseLPFile(path)
        return null
    }
}