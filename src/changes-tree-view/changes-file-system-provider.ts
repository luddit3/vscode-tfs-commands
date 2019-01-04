import * as vscode from 'vscode';
import { IEntry } from './entry.model';
import * as fs from 'fs';
import * as path from 'path';
import { FileStat } from './file-stat';
import { FileUtils } from './file-utils';
import { IIncludedChanges } from './models/tfs/included-changes.model';
import { spawn } from 'child_process';
import { TextDecoder } from 'util';
import * as os from 'os';

export class ChangesFileSystemProvider implements vscode.TreeDataProvider<IEntry>, vscode.FileSystemProvider {

    public get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
        return this._onDidChangeFile.event;
    }

    private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
    private includedChanges: Map<string, IIncludedChanges> = new Map<string, IIncludedChanges>();
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    private context: vscode.ExtensionContext;

    // tslint:disable-next-line:member-ordering
    public readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    private refreshDelay: number = 0;

    private tfs: any = require('tfs');

    public constructor(context: vscode.ExtensionContext, includedChanges: Map<string, IIncludedChanges>) {
        this.context = context;
        this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
        this.includedChanges = includedChanges;
        this.registerCommands();
        vscode.workspace.onDidChangeTextDocument(() => {
            if (vscode.window.activeTextEditor === undefined || vscode.window.activeTextEditor.document.isDirty) {
                return;
            }

            if (vscode.window.activeTextEditor) {
                this.refresh();
            }
        });
        setInterval(() => {
            this.refresh();
        }, 2000);
    }

    public async refresh(): Promise<void> {
        await this.getTfsIncludedChanges();
    }

    public watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        const watcher: any = fs.watch(uri.fsPath, { recursive: options.recursive }, async(event: string, filename: string | Buffer) => {
            const filepath: any = path.join(uri.fsPath, FileUtils.normalizeNFC(filename.toString()));
            this._onDidChangeFile.fire([{
                type: event === 'change' ? vscode.FileChangeType.Changed : await FileUtils.exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
                uri: uri.with({ path: filepath })
            } as vscode.FileChangeEvent]);
            await this.refresh();
        });

        return { dispose: (): any => watcher.close() };
    }

    public stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        return this._stat(uri.fsPath);
    }

    public async _stat(path: string): Promise<vscode.FileStat> {
        return new FileStat(await FileUtils.stat(path));
    }

    public readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        return this._readDirectory(uri);
    }

    public async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const result: [string, vscode.FileType][] = [];
        const changes: string[] = Array.from(this.includedChanges.keys());
        const children: string[] = await FileUtils.readdir(uri.fsPath);
        for (const child of children) {
            const childFilePath: string = path.join(uri.fsPath, child);
            const stat: vscode.FileStat = await this._stat(childFilePath);
            if (changes.find((value: string) => value.toLowerCase().startsWith(childFilePath.toLowerCase()))) {
                result.push([child, stat.type]);
            }
        }

        return Promise.resolve(result);
    }

    public createDirectory(uri: vscode.Uri): void | Thenable<void> {
        return FileUtils.mkdir(uri.fsPath);
    }

    public readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
        return FileUtils.readfile(uri.fsPath);
    }

    public writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
        return this._writeFile(uri, content, options);
    }

    public async _writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        const exists: boolean = await FileUtils.exists(uri.fsPath);
        if (!exists) {
            if (!options.create) {
                throw vscode.FileSystemError.FileNotFound();
            }

            await FileUtils.mkdir(path.dirname(uri.fsPath));
        } else {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            }
        }

        return FileUtils.writefile(uri.fsPath, content as Buffer);
    }

    public delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
        if (options.recursive) {
            return FileUtils.rmrf(uri.fsPath);
        }

        return FileUtils.unlink(uri.fsPath);
    }

    public rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
        return this._rename(oldUri, newUri, options);
    }

    public async _rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
        const exists: boolean = await FileUtils.exists(newUri.fsPath);
        if (exists) {
            if (!options.overwrite) {
                throw vscode.FileSystemError.FileExists();
            } else {
                await FileUtils.rmrf(newUri.fsPath);
            }
        }

        const parentExists: boolean = await FileUtils.exists(path.dirname(newUri.fsPath));
        if (!parentExists) {
            await FileUtils.mkdir(path.dirname(newUri.fsPath));
        }

        return FileUtils.rename(oldUri.fsPath, newUri.fsPath);
    }

    public async getChildren(element?: IEntry): Promise<IEntry[]> {
        if (element) {
            const children: [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> = await this.readDirectory(element.uri);

            return children.map(([name, type]: [string, vscode.FileType]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
        }

        const workspaceFolder: vscode.WorkspaceFolder | null = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.filter((folder: vscode.WorkspaceFolder) => folder.uri.scheme === 'file')[0] : null;
        if (workspaceFolder) {
            const children: [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> = await this.readDirectory(workspaceFolder.uri);
            children.sort((a: [string, vscode.FileType], b: [string, vscode.FileType]) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }

                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });

            return children.map(([name, type]: [string, vscode.FileType]) => ({ uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, name)), type }));
        }

        return [];
    }

    public getTreeItem(element: IEntry): vscode.TreeItem {
        const treeItem: vscode.TreeItem = new vscode.TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
        if (element.type === vscode.FileType.File) {
            treeItem.command = { command: 'fileExplorer.openFile', title: 'Open File', arguments: [element.uri] };
            treeItem.contextValue = 'file';
        }

        return treeItem;
    }

    private async getTfsIncludedChanges(): Promise<void> {
        await this.delay(this.refreshDelay);
        const tfs: any = require('tfs');

        return new Promise((resolve: (value?: any | PromiseLike<any>) => void, reject: (reason?: any) => void): void => {
            resolve(tfs('status', [vscode.workspace.rootPath], { recursive: true }, this.setIncludedChangesCallback));
        });
    }

    private setIncludedChangesCallback: (responseError: any, response: any) => void = (responseError: any, response: any): void => {
        if (response && response.status && response.status.includedChanges) {
            const changes: IIncludedChanges[] = response.status.includedChanges;
            this.includedChanges.clear();
            for (const change of changes) {
                this.includedChanges.set(change.filePath, change);
            }
            this._onDidChangeTreeData.fire();
        }
        if (response && !response.hasPendingChanges) {
            this.includedChanges.clear();
            this._onDidChangeTreeData.fire();
        }
    }

    private delay(milliSeconds: number): Promise<void> {
        return new Promise((resolve: (value?: any | PromiseLike<any>) => void, reject: (reason?: any) => void): any => setTimeout(resolve, milliSeconds));
    }

    private registerCommands(): void {
        const tfsUndo: vscode.Disposable = vscode.commands.registerCommand('tfs.undoChanges', (resource: any) => {
            this.undoChanges(resource.uri.path);
        });
        const tfsDiff: vscode.Disposable = vscode.commands.registerCommand('tfs.diff', (resource: any) => {
            this.diffChanges(resource.uri);
        });
        this.context.subscriptions.push(tfsUndo);
        this.context.subscriptions.push(tfsDiff);
    }

    private undoChanges(path: string): void {
        const cleanedPath: string = path.substr(1);
        this.tfs('undo', [cleanedPath], { recursive: true }, (responseError: any, response: any) => {
            if (responseError) {
                const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(`Undo changes error: ${cleanedPath}`);
                outputChannel.append(responseError.stdout);
                outputChannel.show();
            }
        });
    }

    private diffChanges(uri: vscode.Uri): void {
        const cleanedPath: string = uri.path.substr(1);
        const tfPath: string = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Enterprise\\Common7\\IDE\\CommonExtensions\\Microsoft\\TeamFoundation\\Team Explorer\\TF.exe';
        try {
            const args = ['view', cleanedPath];
            const batch = spawn(tfPath, args, {});
            batch.stdout.on('data', (data: any) => {
                if (data) {
                    const decoder: TextDecoder = new TextDecoder('utf-8');
                    const fileContent: string = decoder.decode(data);
                    const tempFilePath: string = `${os.tmpdir()}\\${uri.path.split('/').pop()}`;
                    fs.writeFileSync(tempFilePath, fileContent);

                    vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse(`file:///${tempFilePath}`), uri);
                }
            });

            batch.stderr.on('data', (data: any) => {
                const decoder: TextDecoder = new TextDecoder('utf-8');
                const fileContent: string = decoder.decode(data);
                console.log(fileContent);
            });

            batch.on('error', (error: any) => {
                const decoder: TextDecoder = new TextDecoder('utf-8');
                const fileContent: string = decoder.decode(error);
                console.log(fileContent);
            });

            batch.on('close', () => {

            });

        } catch (error) {
            console.log(error);
        }
    }

}
