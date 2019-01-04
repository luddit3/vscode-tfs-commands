// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ChangesFileExplorer } from './changes-tree-view/changes-file-explorer';
import { History } from './history/history';
import { TfsCommands } from './tfs-commands/tfs-commands';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
    const tfs: any = require('tfs');
    const tfsCommands: TfsCommands = new TfsCommands();

    vscode.workspace.onDidChangeTextDocument(() => {
        if (vscode.window.activeTextEditor === undefined || vscode.window.activeTextEditor.document.isDirty) {
            return;
        }

        if (vscode.window.activeTextEditor) {
            tfsCommands.checkoutFilePath(vscode.window.activeTextEditor.document.fileName, false);
        }
    });

    const tfsGet: vscode.Disposable = vscode.commands.registerCommand('extension.tfsGet', (uri: vscode.Uri) => {
        getLatest(tfs, uri);
    });

    const tfsCheckout: vscode.Disposable = vscode.commands.registerCommand('extension.tfsCheckout', (uri: vscode.Uri) => {
        tfsCommands.checkoutFilePath(uri.fsPath, true);
    });

    context.subscriptions.push(tfsGet);
    context.subscriptions.push(tfsCheckout);

    // tslint:disable-next-line:no-unused-expression
    new ChangesFileExplorer(context);

    // tslint:disable-next-line:no-unused-expression
    new History(context);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
    //
}

const showResponseMessage: (responseError: any, response: any) => void = (responseError: any, response: any): Promise<void> => {
    if (response && response.message) {
        if (response.hasUpdated) {
            vscode.window.showInformationMessage(`${response.message}\r\n${response.stdout}`);
        } else {
            vscode.window.showInformationMessage(response.message);
        }
    }
    if (responseError && responseError.message) {
        vscode.window.showErrorMessage(responseError.message);
    }

    return Promise.resolve();
};

function getLatest(tfs: any, uri?: vscode.Uri): void {
    const progressOptions: vscode.ProgressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: 'Getting Latest'
    };
    vscode.window.withProgress(progressOptions, (progress: vscode.Progress<any>, token: vscode.CancellationToken): Thenable<{}> => {
        progress.report({ increment: 50, location: vscode.ProgressLocation.Notification, title: 'Getting Latest' });

        return new Promise((resolve: (value?: any | PromiseLike<any>) => void, reject: (reason?: any) => void): void => {
            resolve(tfs('get', [uri && uri.fsPath ? uri.fsPath : ''], { recursive: true }, showResponseMessage));
        }).then(() => {
            progress.report({ increment: 100, location: vscode.ProgressLocation.Notification, title: 'Getting Latest' });

            return Promise.resolve({});
        });
    });
}
