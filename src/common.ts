//@include "./xtools/xlib/stdlib.js";
/// <reference path="legacy.d.ts" />

namespace LabelPlus {

    // --------------- Common --------------- //

    export function min(a: number, b: number): number {
        return (a < b) ? a : b;
    }
    export function emit(func: Function) {
        if (func) {
            func();
        }
    }
    export function assert(condition: any, msg?: string): asserts condition {
        if (!condition) {
            throw new Error("error: assert " + condition + (msg ? (", msg=" + msg) : ""));
        }
    }
    export function delArrayElement<T>(arr: T[], element: T) {
        let idx = arr.indexOf(element);
        if (idx >= 0) arr.splice(idx, 1);
    }

    // --------------- Constants --------------- //

    export const DIR_SEPARATOR    = $.os.search(/windows/i) === -1 ? '/' : '\\';
    export const IMAGE_EXTENSIONS = [".psd", ".png", ".jpg", ".jpeg", ".tif", ".tiff"];
    export const TEMPLATE_LAYER   = {
        TEXT:  "text",
        IMAGE: "bg",
        DIALOG_OVERLAY: "dialog-overlay",
    }

    // --------------- File Related --------------- //

    export function isFileExists(path: string): boolean {
        return (new File(path)).exists;
    }
    export function getFileExtension(filename: string): string {
        return filename.substring(filename.lastIndexOf("."), filename.length)
    }

    export function GetScriptFilePath(): string {
        return <string>$.fileName;
    }
    export function GetScriptFolderPath(): string {
        return (new Folder(GetScriptFilePath())).path;
    }
    export function GetImagePathList(path: string): string[] {
        const folder = new Folder(path);
        if (!folder.exists) return [];

        const fileList: File[] = folder.getFiles();
        const pathList: string[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            if (file instanceof File) {
                let temp = file.toString().split("/");
                let simpleName = temp[temp.length - 1];
                for (let i = 0; i < IMAGE_EXTENSIONS.length; i++) {
                    if (endsWith(simpleName.toLowerCase(), IMAGE_EXTENSIONS[i])) {
                        pathList.push(simpleName);
                        break;
                    }
                }
            }
        }

        return pathList.sort();
    }

    // --------------- String --------------- //

    export function startsWith(str: string, head: string): boolean {
        return str.indexOf(head) === 0;
    }
    export function endsWith(str: string, suffix: string): boolean {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }

    // --------------- Action --------------- //

    export function doAction(action: string, actionSet: string): boolean {
        if (Stdlib.hasAction(action, actionSet)) {
           app.doAction(action, actionSet);
           return true;
        }

        return false;
    }

    // --------------- Global Variable --------------- //

    let dataPath = Folder.appData.fsName + DIR_SEPARATOR + "labelplus_script";
    let dataFolder = new Folder(dataPath);
    if (!dataFolder.exists) {
        if (!dataFolder.create()) {
            dataPath = Folder.temp.fsName;
        }
    }
    export const APP_DATA_FOLDER: string = dataPath;
    export const DEFAULT_LOG_PATH: string = APP_DATA_FOLDER + DIR_SEPARATOR + "lp_ps_script.log";
    export const DEFAULT_INI_PATH: string = APP_DATA_FOLDER + DIR_SEPARATOR + "lp_ps_script.ini";
    export const DEFAULT_DUMP_PATH: string = APP_DATA_FOLDER + DIR_SEPARATOR + "lp_ps_script.dump";
    export let commonLog: string = "";
    export let errorLog: string = "";

    Stdlib.log.setFile(DEFAULT_LOG_PATH);
    export function log(msg: any) { Stdlib.log(msg); commonLog += msg + '\n'; }
    export function err(msg: any) { Stdlib.log(msg); errorLog += msg + '\n'; commonLog += msg + '\n'; }
    export function dump(o: any) { alert(Stdlib.listProps(o)); }

    export function FileNamePair(origin: string, matched: string): string {
        return origin + "(" + matched + ")";
    }

}