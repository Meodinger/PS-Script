// LabelPlusFX JSON格式Reader
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

    interface MeoFile {
        version: number[];
        comment: string;
        groupList: {
            color: string;
            name: string;
        }[],
        transMap: {
            [key: string]: {
                groupId: number;
                index: number;
                text: string;
                x: number;
                y: number;
            }[];
        }
    }

    export function lpTextParser(path: string): LpFile | null {
        const f = new File(path);
        if (!f || !f.exists) {
            return null;
        }

        f.open("r", "TEXT", "????");
        f.lineFeed = "unix";
        f.encoding = "UTF-8";

        const meo = f.read();
        const data = (new Function('return ' + meo))();

        f.close();

        // ugly js

        const meoFile: MeoFile = data;

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
                    contents: label.text,
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
}