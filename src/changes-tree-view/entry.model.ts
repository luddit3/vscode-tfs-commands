import * as vscode from 'vscode';

export interface IEntry {
    uri: vscode.Uri;
    type: vscode.FileType;
}
