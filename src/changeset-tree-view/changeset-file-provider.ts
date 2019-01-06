import * as vscode from 'vscode';
import * as lodash from 'lodash';
import { Changeset } from '../tfs-commands/models/changeset.model';

export class ChangesetFileSystemProvider implements vscode.TreeDataProvider<ChangesetFile> {

    public _onDidChangeTreeData: vscode.EventEmitter<ChangesetFile | undefined> = new vscode.EventEmitter<ChangesetFile | undefined>();

    public readonly onDidChangeTreeData: vscode.Event<ChangesetFile | undefined> = this._onDidChangeTreeData.event;

    constructor(private filePaths: ChangesetFile[]) {
    }

    public getTreeItem(element: ChangesetFile): vscode.TreeItem {
        const command: vscode.Command = {
            title: '',
            command: 'changesExplorer.openDiff',
            tooltip: '',
            arguments: [{ id: element.changeset.id, date: element.changeset.date, fileName: element.fileName }]
        };
        const treeItem: vscode.TreeItem = {
            label: element.label,
            id: element.id,
            iconPath: element.iconPath,
            tooltip: element.tooltip,
            collapsibleState: element.label && element.label.includes('.') ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded,
            contextValue: element.contextValue,
            command: command
        };
        return treeItem;
    }

    public getChildren(element?: ChangesetFile): ChangesetFile[] {
        if (!element) {
            const children: ChangesetFile[] = lodash.cloneDeep(this.filePaths);
            const uniqueChangesetPaths: Map<string, ChangesetFile> = new Map<string, ChangesetFile>();
            for (let i: number = 0; i < children.length; i++) {
                const child: ChangesetFile = children[i];
                if (child.label && child.label.includes('.')) {
                    const filePaths: string[] = child.label.split('/');
                    filePaths.pop();
                    child.label = filePaths.join('/');
                    child.iconPath = vscode.ThemeIcon.Folder;
                    uniqueChangesetPaths.set(child.label, child);
                }
            }
            const changesetPaths: ChangesetFile[] = [];
            uniqueChangesetPaths.forEach((value: ChangesetFile) => {
                changesetPaths.push(value);
            });
            return changesetPaths;
        }
        if (element.label && !element.label.includes('.')) {
            const childrenChangeset: ChangesetFile[] = [];
            for (const file of this.filePaths) {
                if (this.isDirectChildPath(element, file)) {
                    if (file.label) {
                        file.label = file.label.split('/').pop();
                        file.iconPath = vscode.ThemeIcon.File;
                    }
                    childrenChangeset.push(file);
                }
            }
            return childrenChangeset;
        }
        return [];
    }


    private isDirectChildPath(element: ChangesetFile, file: ChangesetFile): boolean {
        if (element.label) {
            if (file.fileName.startsWith(element.label) && file.fileName.includes('.')) {
                const partialPath: string = file.fileName.substring(element.label.length);
                if (partialPath) {
                    const childPathOccurences: RegExpMatchArray | null = partialPath.match(/\//g);
                    if (childPathOccurences && childPathOccurences.length === 1) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}

export class ChangesetFile extends vscode.TreeItem {

    get tooltip(): string {
        return `${this.label}`;
    }

    get description(): string {
        return '';
    }

    // contextValue = 'dependency';

    constructor(
        public readonly fileName: string,
        public visiblePath: string,
        public changeset: Changeset,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(visiblePath, collapsibleState);
    }

}
