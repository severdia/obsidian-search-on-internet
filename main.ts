import {Editor, EventRef, MarkdownPreviewView, MarkdownView, Menu, MenuItem, Notice, Plugin, TFile} from 'obsidian';
import {SOISettingTab, SOISettings, DEFAULT_SETTING, SearchSetting, DEFAULT_QUERY} from './settings';
const {shell} = require('electron');
import {SearchModal} from './modal';
import {SearchView} from './view';


export default class SearchOnInternetPlugin extends Plugin {
    settings: SOISettings;

    async onload() {
      console.log('loading search-on-internet');

      await this.loadSettings();

      this.addSettingTab(new SOISettingTab(this.app, this));
      const plugin = this;
      this.registerEvent(
          this.app.workspace.on('file-menu', (menu, file: TFile, source: string) => {
            if (!(file instanceof TFile)) {
              return;
            }
            const fileTags = this.app.metadataCache.getFileCache(file)
                ?.tags?.map((t) => t.tag);
            this.settings.searches.forEach((search) => {
              if (search.tags.length === 0 ||
                        fileTags?.some((t) => search.tags.contains(t))) {
                menu.addItem((item) => {
                  item.setTitle(`Search ${search.name}`).setIcon('search')
                      .onClick((evt) => {
                        plugin.openSearch(search, file.basename);
                      });
                });
              }
            });
          }));

      this.addCommand({
        id: 'search-on-internet',
        name: 'Perform search',
        callback: () => {
          let query = this.getSelectedText();

          if (query === null || query === '') {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView == null) {
              return;
            }
            query = activeView.getDisplayText();
          }
          const modal = new SearchModal(plugin.app, plugin, query);
          modal.open();
        },
      });

      // Preview mode
      this.registerDomEvent(document, 'contextmenu', (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target?.closest?.('.markdown-preview-view')) return;
        const fileMenu = new Menu();
        // Functionality: Open external link in Iframe.
        let emptyMenu = true;
        if (event.target) {
          // @ts-ignore
          const classes: DOMTokenList = event.target.classList;
          // @ts-ignore
          if (classes.contains('cm-url') || classes.contains('external-link')) {
            // @ts-ignore
            const url = classes.contains('cm-url') ? event.target.textContent : event.target.href;

            fileMenu.addItem((item: MenuItem) => {
              item.setIcon('search').setTitle('Open in IFrame').onClick(() => {
                plugin.openSearch({
                  tags: [],
                  query: '{{query}}',
                  name: '',
                  encode: false,
                }, url, null);
              });
            });
            emptyMenu = false;
          }
        }
        const selection = target.ownerDocument.getSelection()?.toString() ?? '';
        const hasSearchItems = plugin.handleContext(fileMenu, selection);
        emptyMenu = emptyMenu && !hasSearchItems;
        if (!emptyMenu) {
          fileMenu.showAtPosition({x: event.x, y: event.y});
          event.preventDefault();
        }
      });


      // Remove this ignore when the obsidian package is updated on npm
      // Editor mode
      // @ts-ignore
      this.registerEvent(this.app.workspace.on('editor-menu',
          (menu: Menu, editor: Editor, view: MarkdownView) => {
            this.handleContext(menu, editor.getSelection());
          }));
    }

    getSelectedText(): string {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view?.getMode() === 'source') return view.editor.getSelection();
      const doc = view?.containerEl.ownerDocument ?? document;
      return doc.getSelection()?.toString() ?? '';
    }

    handleContext(menu: Menu, query = this.getSelectedText()): boolean {
      const hasSelection = !(query === null || query.trim() === '');
      if (!hasSelection) {
        return false;
      }
      for (const searchsetting of this.settings.searches) {
        menu.addItem((item: MenuItem) => {
          item.setTitle('Search on ' + searchsetting.name)
              .setIcon('search')
              .onClick((evt: MouseEvent) => this.openSearch(searchsetting, query, null));
        });
      }
      return true;
    }

    async openSearch(search: SearchSetting, query: string, activeView: SearchView=null) {
      let encodedQuery = query;
      if (search.encode) {
        encodedQuery= encodeURIComponent(query);
      }
      const url = search.query.replace('{{title}}', encodedQuery)
          .replace('{{query}}', encodedQuery);
      console.log(`SOI: Opening URL ${url}`);
      if (this.settings.useIframe) {
        if (activeView) {
          activeView.frame.setAttr('src', url);
          activeView.url = url;
        } else {
          const leaf = this.app.workspace.getLeaf(!(this.app.workspace.activeLeaf.view.getViewType() === 'empty'));
          // const leaf = this.app.workspace.splitActiveLeaf(this.settings.splitDirection);
          const view = new SearchView(this, leaf, query, search.name, url);
          await leaf.open(view);
        }
      } else {
        await shell.openExternal(url);
      }
    }

    onunload() {
      console.log('unloading search-on-internet');
    }

    async loadSettings() {
      const loadedSettings = await this.loadData() as any;
      if (loadedSettings && loadedSettings.hasOwnProperty('searches')) {
        loadedSettings.searches = Array.from(
            loadedSettings.searches.map(
                (s: SearchSetting) => Object.assign({}, DEFAULT_QUERY, s)));
        this.settings = loadedSettings;
      } else {
        this.settings = DEFAULT_SETTING;
      }
    }

    async saveSettings() {
      await this.saveData(this.settings);
    }
}


