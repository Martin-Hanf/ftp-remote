'use babel';

import SelectListView from 'atom-select-list'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'
import FileView from './file-view.js';
import { Disposable, CompositeDisposable } from 'atom'
import { getFullExtension, createLocalPath } from './../helper/helper.js';
import { highlight, normalize } from './../helper/format.js';

const Queue = require('./../helper/queue.js');
const Path = require('path');
const tempDirectory = require('os').tmpdir();
const FileSystem = require('fs-plus');

export default class FinderView {
  constructor(treeView) {
    const self = this;

    self.items = [];
    self.itemsCache = null;
    self.treeView = treeView;
    self.root = null;

    self.selectListView = new SelectListView({
      items: [],
      maxResults: 25,
      emptyMessage: 'No files found\u2026',
      filterKeyForItem: (item) => item.file,
      didCancelSelection: () => { self.cancel(); },
      didConfirmSelection: (item) => {
        self.open(item);
        self.cancel();
      },
      elementForItem: ({ relativePath }) => {
        const filterQuery = self.selectListView.getFilterQuery();
        const matches = self.useAlternateScoring ?
          fuzzaldrin.match(relativePath, filterQuery) :
          fuzzaldrinPlus.match(relativePath, filterQuery);

        const li = document.createElement('li');
        const fileBasename = Path.basename(relativePath);
        const baseOffset = relativePath.length - fileBasename.length;
        const primaryLine = document.createElement('div');
        const secondaryLine = document.createElement('div');

        li.classList.add('two-lines');

        primaryLine.classList.add('primary-line', 'file', 'icon-file-text');
        primaryLine.dataset.name = fileBasename;
        primaryLine.dataset.path = relativePath;
        primaryLine.appendChild(highlight(fileBasename, matches, baseOffset));
        li.appendChild(primaryLine);

        secondaryLine.classList.add('secondary-line', 'path', 'no-icon');
        secondaryLine.appendChild(highlight(relativePath, matches, 0));
        li.appendChild(secondaryLine);

        return li;
      },
      order: (item1: Object, item2: Object) => {
        return item1.relativePath.length - item2.relativePath.length;
      }
    });

    // Add class to use stylesheets from this package
    self.selectListView.element.classList.add('remote-finder');

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.config.observe('remote-finder.useAlternateScoring', (newValue) => {
        this.useAlternateScoring = newValue
        if (this.useAlternateScoring) {
          this.selectListView.update({
            filter: (items, query) => {
              return query ? fuzzaldrinPlus.filter(items, query, { key: 'file' }) : items
            }
          })
        } else {
          this.selectListView.update({ filter: null })
        }
      })
    );
  }

  get element() {
    const self = this;

    return self.selectListView.element;
  }

  show() {
    const self = this;

    self.previouslyFocusedElement = document.activeElement;
    if (!self.panel) {
      self.panel = atom.workspace.addModalPanel({ item: self });
    }
    self.panel.show();
    self.selectListView.focus();
  }

  hide() {
    const self = this;

    if (self.panel) {
      self.panel.hide();
    }
    if (self.previouslyFocusedElement) {
      self.previouslyFocusedElement.focus();
      self.previouslyFocusedElement = null;
    }
  }

  cancel() {
    const self = this;

    self.selectListView.reset();
    self.hide();
  }

  toggle() {
    const self = this;

    if (self.panel && self.panel.isVisible()) {
      self.cancel();
    } else {
      self.show();
    }
  }

  destroy() {
    const self = this;

    if (self.panel) {
      self.panel.destroy();
    }

    if (self.subscriptions) {
      self.subscriptions.dispose();
      self.subscriptions = null;
    }
    return self.selectListView.destroy();
  }

  open(item) {
    const self = this;

    let relativePath = item.relativePath;
    let localPath = normalize((self.root.getLocalPath() + relativePath).replace(/\/+/g, Path.sep), Path.sep);

    try {
      let file = self.treeView.getElementByLocalPath(localPath, self.root, 'file');
      self.size = item.size;
      file.open();
    } catch (ex) {}
  }
}