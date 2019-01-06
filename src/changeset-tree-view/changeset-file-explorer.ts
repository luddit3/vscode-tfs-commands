import * as vscode from 'vscode';
import { TfsCommands } from '../tfs-commands/tfs-commands';
import { Changeset } from '../tfs-commands/models/changeset.model';
import * as fs from 'fs';
import * as os from 'os';

export class ChangesetFileExplorer {

    private tfs: TfsCommands = new TfsCommands();

    constructor() {
        this.activate();
    }

    public openResource(changeset: any): void {
        this.tfs.getFile(changeset.fileName, `C${changeset.id.toString()}`, ((file: string) => {
            const selectedChangesetFileVersion: string = file;
            if (vscode.workspace.rootPath) {
                this.tfs.getPreviousVersion(`c:/${vscode.workspace.rootPath.split('\\')[1]}${changeset.fileName.slice(1)}`, changeset.id, ((changesets: Changeset[]) => {
                    if (changesets.length === 2) {
                        this.tfs.getFile(changesets[1].items[0].path, changesets[1].id.toString(), ((previousVersion: string) => {
                            const tempFilePath: string = `${os.tmpdir()}\\version1${changeset.fileName.split('/').pop()}`;
                            const secondTempFilePath: string = `${os.tmpdir()}\\version2${changeset.fileName.split('/').pop()}`;
                            fs.writeFileSync(tempFilePath, selectedChangesetFileVersion);
                            fs.writeFileSync(secondTempFilePath, previousVersion);
                            if (vscode.workspace.rootPath) {
                                vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse(`file:///${secondTempFilePath}`), vscode.Uri.parse(`file:///${tempFilePath}`));
                            }
                        }));
                    }
                    if (changesets.length === 1) {
                        const tempFilePath: string = `${os.tmpdir()}\\version1${changeset.fileName.split('/').pop()}`;
                        const secondTempFilePath: string = `${os.tmpdir()}\\version2${changeset.fileName.split('/').pop()}`;
                        fs.writeFileSync(tempFilePath, selectedChangesetFileVersion);
                        fs.writeFileSync(secondTempFilePath, '');
                        if (vscode.workspace.rootPath) {
                            vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse(`file:///${secondTempFilePath}`), vscode.Uri.parse(`file:///${tempFilePath}`));
                        }
                    }
                }));
            }
        }));
    }


    private activate(): void {
        vscode.commands.registerCommand('changesExplorer.openDiff', (resource: any) => this.openResource(resource));
    }


}
