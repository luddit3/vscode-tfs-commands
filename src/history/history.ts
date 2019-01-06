import * as vscode from 'vscode';
import { TfsCommands } from '../tfs-commands/tfs-commands';
import { Changeset, IChangesetItem } from '../tfs-commands/models/changeset.model';
import { HistoryMenuSelection } from '../models/history-menu-selection.model';
import { FilesMenuSelection } from '../models/files-menu-selection.model';
import * as fs from 'fs';
import * as os from 'os';
import { ChangesetFileSystemProvider, ChangesetFile } from '../changeset-tree-view/changeset-file-provider';

export class History {

    private context: vscode.ExtensionContext;
    private tfs: TfsCommands = new TfsCommands();
    private historyCount: number = 15;
    private changesets: Changeset[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.registerHistoryQuickCommand();
    }

    private registerHistoryQuickCommand(): void {
        const tfsViewHistory: vscode.Disposable = vscode.commands.registerCommand('extension.tfsViewHistory', (uri: vscode.Uri) => {
            this.getHistory(uri.fsPath);
        });

        const tfsDiffChangesets: vscode.Disposable = vscode.commands.registerCommand('extension.tfsDiffChangesets', (uri: vscode.Uri) => {
            this.getFileChangesets(uri.fsPath);
        });

        this.context.subscriptions.push(tfsViewHistory);
        this.context.subscriptions.push(tfsDiffChangesets);
    }

    private getFileChangesets(filePath: string): void {
        this.tfs.getHistory(filePath, this.historyCount, (changesets: Changeset[]) => {
            this.changesets = changesets;
            this.showDiffSelectionQuickPick(filePath);
        });
    }

    private showDiffSelectionQuickPick(filePath: string): void {
        const changeSelections: vscode.QuickPickItem[] = this.changesets.map((value: Changeset, index: number, array: Changeset[]) => {
            const item: vscode.QuickPickItem = {
                label: value.id.toString(),
                detail: value.comments,
                description: value.user
            };
            return item;
        });
        const options: vscode.QuickPickOptions = {
            placeHolder: 'Select a two changesets to diff...',
            matchOnDescription: true,
            matchOnDetail: true,
            canPickMany: true
        };
        vscode.window.showQuickPick<vscode.QuickPickItem>(changeSelections, options).then((value: any) => {
            const quickPickSelections: vscode.QuickPickItem[] = value;
            if (quickPickSelections) {
                if (quickPickSelections.length !== 2) {
                    vscode.window.showErrorMessage('Error: Exactly 2 changesets must be selected to diff files.');
                } else {
                    const firstChangesetValue: string = `C${quickPickSelections[0].label}`;
                    this.tfs.getFile(filePath, firstChangesetValue, ((file: string) => {
                        const firstChangesetPath: string = `${os.tmpdir()}\\${firstChangesetValue}${filePath.split('\\').pop()}`;
                        fs.writeFileSync(firstChangesetPath, file);
                        const secondChangesetValue: string = `C${quickPickSelections[1].label}`;
                        this.tfs.getFile(filePath, secondChangesetValue, ((file: string) => {
                            const secondChangesetPath: string = `${os.tmpdir()}\\${secondChangesetValue}${filePath.split('\\').pop()}`;
                            fs.writeFileSync(secondChangesetPath, file);

                            if (vscode.workspace.rootPath) {
                                vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse(`file:///${secondChangesetPath}`), vscode.Uri.parse(`file:///${firstChangesetPath}`));
                            }
                        }));
                    }));
                }
            }
        });
    }

    private getHistory(path: string): void {
        this.tfs.getHistory(path, this.historyCount, this.getHistorySuccessCallback);
    }

    private getHistorySuccessCallback = (changesets: Changeset[]) => {
        this.changesets = changesets;
        this.showChangesetsQuickPick();
    }

    private onDidSelectChangeset(item: vscode.QuickPickItem | undefined): void {
        if (item) {
            const historyMenuOptions: string[] = [HistoryMenuSelection.ViewCompleteDetails, HistoryMenuSelection.ViewAllChangesetFileDiffs, HistoryMenuSelection.ListFilesInChangeset];
            const options: vscode.QuickPickOptions = {
                placeHolder: `Select options for changeset: ${item.label}...`,
                matchOnDescription: true,
                matchOnDetail: true
            };
            vscode.window.showQuickPick(historyMenuOptions, options).then((value: string | undefined) => {
                const selectedChangeset: Changeset | undefined = this.changesets.find(s => s.id === parseInt(item.label, 10));
                switch (value) {
                    case HistoryMenuSelection.ViewCompleteDetails:
                        if (selectedChangeset) {
                            this.showChangeoutDetailsInTerminal(item, selectedChangeset);
                        }
                        break;
                    case HistoryMenuSelection.ListFilesInChangeset:
                        if (selectedChangeset) {
                            this.showChangesetFilesListQuickPick(selectedChangeset);
                        }
                        break;
                    case HistoryMenuSelection.ViewAllChangesetFileDiffs:
                        if (selectedChangeset) {
                            this.showChangesetFileDiffPanel(selectedChangeset);
                        }
                        break;
                    default:
                        break;
                }
            });
        }
    }

    private showChangesetFileDiffPanel(selectedChangeset: Changeset): void {
        const changesets: ChangesetFile[] = selectedChangeset.items.map(s => new ChangesetFile(s.path, s.path, selectedChangeset, vscode.TreeItemCollapsibleState.Expanded));
        const treeDataProvider: ChangesetFileSystemProvider = new ChangesetFileSystemProvider(changesets);
        vscode.window.createTreeView('changesetFileExplorer', { treeDataProvider: treeDataProvider });
        vscode.commands.executeCommand('changesetFileExplorer.focus').then(() => {

        });
    }

    private showChangesetFilesListQuickPick(selectedChangeset: Changeset): void {
        const filesList: vscode.QuickPickItem[] = selectedChangeset.items.map((value: IChangesetItem, index: number, array: IChangesetItem[]) => {
            const item: vscode.QuickPickItem = {
                label: value.path,
                detail: value.type
            };
            return item;
        });
        const options: vscode.QuickPickOptions = {
            placeHolder: 'Select a file to view its options...',
            matchOnDescription: true,
            matchOnDetail: true
        };
        vscode.window.showQuickPick(filesList, options).then((value: vscode.QuickPickItem | undefined) => {
            if (value) {
                const options: vscode.QuickPickOptions = {
                    placeHolder: `Select a command to use for file: ${value.label}`,
                    matchOnDescription: true,
                    matchOnDetail: true
                };
                vscode.window.showQuickPick([FilesMenuSelection.CompareWithLatestVersion], options).then((result: string | undefined) => {
                    switch (result) {
                        case FilesMenuSelection.CompareWithLatestVersion:
                            this.tfs.getFile(value.label, `C${selectedChangeset.id}`, ((file: string) => {
                                const tempFilePath: string = `${os.tmpdir()}\\${value.label.split('/').pop()}`;
                                fs.writeFileSync(tempFilePath, file);
                                if (vscode.workspace.rootPath) {
                                    vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse(`file:///${tempFilePath}`), vscode.Uri.parse(`file:///${vscode.workspace.rootPath.split('\\')[1]}${value.label.slice(1)}`));
                                }
                            }));
                            break;

                        default:
                            break;
                    }
                });
            }
        });
    }

    private showChangeoutDetailsInTerminal(item: vscode.QuickPickItem, selectedChangeset: Changeset | undefined): void {
        const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(`Changset: ${item.label}`);
        if (selectedChangeset) {
            outputChannel.append(selectedChangeset.toString());
        }
        outputChannel.show();
    }

    private showChangesetsQuickPick(): void {
        const changeSelections: vscode.QuickPickItem[] = this.changesets.map((value: Changeset, index: number, array: Changeset[]) => {
            const item: vscode.QuickPickItem = {
                label: value.id.toString(),
                detail: value.comments,
                description: value.user
            };
            return item;
        });
        const options: vscode.QuickPickOptions = {
            placeHolder: 'Select a changeset...',
            matchOnDescription: true,
            matchOnDetail: true
        };
        vscode.window.showQuickPick(changeSelections, options).then(this.onDidSelectChangeset.bind(this));
    }


}
