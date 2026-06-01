export class Plugin {
  app: any;
  loadData = async (): Promise<any> => null;
  saveData = async (_data: any): Promise<void> => {};
}

export class TFile { path = ''; basename = ''; extension = ''; }
export class TFolder { path = ''; }
export class TAbstractFile { path = ''; }
export class Notice { constructor(_msg: string) {} }
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
