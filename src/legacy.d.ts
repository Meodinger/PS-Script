declare function isMac(): any;
declare function toBoolean(n: any): boolean;
declare var GenericUI: any;
declare var LogWindow: any;
declare var MyAction: any;

declare class jamJSON {
	static parse(text: string, validate?: boolean, allowComments?: boolean): any;
	static stringify(value: any, space?: string | number, prefix?: string | number): string;
}

declare var Stdlib: {
	hasAction(action: string, actionSet: string): boolean;
	listProps(obj: any): string;
	log: {
		(msg: string);
		filename: string;
		enabled: boolean;
		encoding: string;
		append: boolean;
		setFile(name: string, encoding?: string);
	};
	createFileSelect(name: string): any;
	selectFileOpen(prompt: string, start: any, def: string): any;
	selectFileSave(prompt: string, start: any, def: string): any;
	selectFolder(prompt: string, start: string): any;

	exceptionMessage(e: Error): string;
	getActionSets(): any[];
}
