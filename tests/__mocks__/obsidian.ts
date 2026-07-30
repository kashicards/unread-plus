export class Plugin {
  app: any;
  loadData = async (): Promise<any> => null;
  saveData = async (_data: any): Promise<void> => {};
}

export class TFile { path = ''; basename = ''; extension = ''; }
export class TFolder { path = ''; }
export class TAbstractFile { path = ''; }
export class FileView { file: TFile | null = null; }
export class Notice {
  static lastMessage: string | null = null;
  message: string;
  constructor(msg: string) {
    this.message = msg;
    Notice.lastMessage = msg;
  }
}
export class PluginSettingTab {
  constructor(public app: any, public plugin: any) {}
  display(): void {}
  hide(): void {}
}
export class Setting {
  constructor(_containerEl: any) {}
  setName(_n: string) { return this; }
  setDesc(_d: string) { return this; }
  addText(_cb: any) { return this; }
  addTextArea(_cb: any) { return this; }
  addToggle(_cb: any) { return this; }
  addDropdown(_cb: any) { return this; }
  addButton(_cb: any) { return this; }
  addColorPicker(_cb: any) { return this; }
}
export class Menu {
  addItem(_cb: any) { return this; }
  addSeparator() { return this; }
}
export class MarkdownRenderChild {
  containerEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }
  onload(): void {}
  onunload(): void {}
  load(): void {
    this.onload();
  }
  unload(): void {
    this.onunload();
  }
}
