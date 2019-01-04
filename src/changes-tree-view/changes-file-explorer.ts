import * as vscode from 'vscode';
import { IEntry } from './entry.model';
import { ChangesFileSystemProvider } from './changes-file-system-provider';
import { IIncludedChanges } from './models/tfs/included-changes.model';
import { TfsCommands } from '../tfs-commands/tfs-commands';
import * as os from 'os';
import * as fs from 'fs';

export class ChangesFileExplorer {

    public fileExplorer: vscode.TreeView<IEntry> | undefined;
    private context: vscode.ExtensionContext;
    private tfs: TfsCommands = new TfsCommands();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.activate();
    }

    private openResource(resource: vscode.Uri): void {
        this.tfs.getFile(resource.fsPath, '', ((file: string) => {
            const tempFilePath: string = `${os.tmpdir()}\\${resource.fsPath.split('\\').pop()}`;
            fs.writeFileSync(tempFilePath, file);
            if (vscode.workspace.rootPath) {
                vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse(`file:///${tempFilePath}`), resource);
            }
        }));
    }

    private activate(): void {
        this.getTfsIncludedChanges();
    }

    private async getTfsIncludedChanges(): Promise<void> {
        const tfs: any = require('tfs');

        return new Promise((resolve: (value?: any | PromiseLike<any>) => void, reject: (reason?: any) => void): void => {
            resolve(tfs('status', [vscode.workspace.rootPath], { recursive: true }, this.setIncludedChangesCallback));
        });
    }

    private setIncludedChangesCallback: (responseError: any, response: any) => void = (responseError: any, response: any): void => {
        if (response && response.status && response.status.includedChanges) {
            const changes: IIncludedChanges[] = response.status.includedChanges;
            const includedChanges: Map<string, IIncludedChanges> = new Map<string, IIncludedChanges>();
            for (const change of changes) {
                includedChanges.set(change.filePath, change);
            }
            const treeDataProvider: ChangesFileSystemProvider = new ChangesFileSystemProvider(this.context, includedChanges);
            this.fileExplorer = vscode.window.createTreeView('changesFileExplorer', { treeDataProvider });

            vscode.commands.registerCommand('fileExplorer.openFile', (resource: any) => this.openResource(resource));
        } else {
            const treeDataProvider: ChangesFileSystemProvider = new ChangesFileSystemProvider(this.context, new Map<string, IIncludedChanges>());
            this.fileExplorer = vscode.window.createTreeView('changesFileExplorer', { treeDataProvider });
            vscode.commands.registerCommand('fileExplorer.openFile', (resource: any) => this.openResource(resource));
        }
    }

}
