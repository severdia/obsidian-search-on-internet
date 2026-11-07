const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const events = {}, domEvents = [];
class Base {}
Base.prototype.registerEvent = function () {};
Base.prototype.registerDomEvent = function (...args) { domEvents.push(args); };
Base.prototype.addSettingTab = function () {};
Base.prototype.addCommand = function (command) { this.command = command; };
class Menu {
  constructor() { this.items = []; Menu.last = this; }
  addItem(callback) {
    const item = { setTitle(t) { this.title = t; return this; }, setIcon() { return this; }, onClick(f) { this.click = f; return this; } };
    callback(item); this.items.push(item);
  }
  showAtPosition(position) { this.position = position; }
}
const obsidian = { Plugin: Base, PluginSettingTab: Base, FuzzySuggestModal: Base, ItemView: Base, MarkdownView: Base, Menu };
const openedUrls = [];
const document = { getSelection: () => null };
const sandbox = { module: { exports: {} }, require: name => name === 'obsidian' ? obsidian : name === 'electron' ? { shell: { openExternal: async url => openedUrls.push(url) } } : (() => { throw Error('Unexpected dependency: ' + name); })(), console, process, document };
vm.runInNewContext(fs.readFileSync(__dirname + '/main.js', 'utf8'), sandbox);
(async () => {
  const plugin = new sandbox.module.exports.default();
  let activeView = null;
  plugin.app = { workspace: { on(name, cb) { events[name] = cb; }, getActiveViewOfType() { return activeView; } } };
  plugin.loadData = async () => ({ searches: [{ name: 'Google', tags: [], query: 'https://google.com/search?q={{query}}', encode: true }], useIframe: false });
  await plugin.onload();
  const searches = [];
  plugin.openSearch = (search, query) => searches.push(query);
  const menu = new Menu();
  let selected = 'café & tea';
  events['editor-menu'](menu, { getSelection: () => selected });
  assert.equal(menu.items.length, 1);
  selected = '';
  menu.items[0].click();
  assert.equal(searches.pop(), 'café & tea');
  for (const text of ['', '  \n']) {
    const empty = new Menu();
    events['editor-menu'](empty, { getSelection: () => text });
    assert.equal(empty.items.length, 0);
  }
  activeView = { getMode: () => 'source', editor: { getSelection: () => 'editor selection' } };
  assert.equal(plugin.getSelectedText(), 'editor selection');
  activeView = null;
  assert.equal(plugin.getSelectedText(), '');
  const listener = domEvents[0][2];
  let prevented = false;
  listener({ target: { closest: () => true, classList: { contains: () => false }, ownerDocument: { getSelection: () => ({ toString: () => 'reading selection' }) } }, x: 10, y: 20, preventDefault() { prevented = true; } });
  assert.equal(Menu.last.items.length, 1);
  Menu.last.items[0].click();
  assert.equal(searches.pop(), 'reading selection');
  assert.equal(prevented, true);
  listener({ target: { closest: () => true, classList: { contains: () => false }, ownerDocument: document }, preventDefault() { throw Error('Empty selection intercepted'); } });
  assert.equal(Menu.last.items.length, 0);
  await sandbox.module.exports.default.prototype.openSearch.call(plugin, plugin.settings.searches[0], 'café & tea');
  assert.equal(openedUrls.pop(), 'https://google.com/search?q=caf%C3%A9%20%26%20tea');
  console.log('Passed: startup without __dirname or Node dependencies, encoded external URL, editor selection, captured query, empty selection, command selection, Reading view, null selection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
