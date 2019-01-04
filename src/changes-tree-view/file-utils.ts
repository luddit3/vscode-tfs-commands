import * as vscode from 'vscode';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as rimraf from 'rimraf';

export class FileUtils {

    public static handleResult<T>(resolve: (result: T) => void, reject: (error: Error) => void, error: Error | null | undefined, result: T): void {
        if (error) {
            reject(FileUtils.massageError(error));
        } else {
            resolve(result);
        }
    }

    public static massageError(error: Error & { code?: string }): Error {
        if (error.code === 'ENOENT') {
            return vscode.FileSystemError.FileNotFound();
        }

        if (error.code === 'EISDIR') {
            return vscode.FileSystemError.FileIsADirectory();
        }

        if (error.code === 'EEXIST') {
            return vscode.FileSystemError.FileExists();
        }

        if (error.code === 'EPERM' || error.code === 'EACCESS') {
            return vscode.FileSystemError.NoPermissions();
        }

        return error;
    }

    public static checkCancellation(token: vscode.CancellationToken): void {
        if (token.isCancellationRequested) {
            throw new Error('Operation cancelled');
        }
    }

    public static normalizeNFC(items: string): string;
    public static normalizeNFC(items: string[]): string[];
    public static normalizeNFC(items: string | string[]): string | string[] {
        if (process.platform !== 'darwin') {
            return items;
        }

        if (Array.isArray(items)) {
            return items.map((item: any) => item.normalize('NFC'));
        }

        return items.normalize('NFC');
    }

    public static readdir(path: string): Promise<string[]> {
        return new Promise<string[]>((resolve: any, reject: any): void => {
            fs.readdir(path, (error: any, children: any) => FileUtils.handleResult(resolve, reject, error, FileUtils.normalizeNFC(children)));
        });
    }

    public static stat(path: string): Promise<fs.Stats> {
        return new Promise<fs.Stats>((resolve: any, reject: any): void => {
            fs.stat(path, (error: any, stat: any) => FileUtils.handleResult(resolve, reject, error, stat));
        });
    }

    public static readfile(path: string): Promise<Buffer> {
        return new Promise<Buffer>((resolve: any, reject: any): void => {
            fs.readFile(path, (error: any, buffer: any) => FileUtils.handleResult(resolve, reject, error, buffer));
        });
    }

    public static writefile(path: string, content: Buffer): Promise<void> {
        return new Promise<void>((resolve: any, reject: any): void => {
            fs.writeFile(path, content, (error: any) => FileUtils.handleResult(resolve, reject, error, void 0));
        });
    }

    public static exists(path: string): Promise<boolean> {
        return new Promise<boolean>((resolve: any, reject: any): void => {
            fs.exists(path, (exists: boolean) => FileUtils.handleResult(resolve, reject, null, exists));
        });
    }

    public static rmrf(path: string): Promise<void> {
        return new Promise<void>((resolve: any, reject: any): void => {
            rimraf(path, (error: any) => FileUtils.handleResult(resolve, reject, error, void 0));
        });
    }

    public static mkdir(path: string): Promise<void> {
        return new Promise<void>((resolve: any, reject: any): void => {
            mkdirp(path, (error: any) => FileUtils.handleResult(resolve, reject, error, void 0));
        });
    }

    public static rename(oldPath: string, newPath: string): Promise<void> {
        return new Promise<void>((resolve: any, reject: any): void => {
            fs.rename(oldPath, newPath, (error: any) => FileUtils.handleResult(resolve, reject, error, void 0));
        });
    }

    public static unlink(path: string): Promise<void> {
        return new Promise<void>((resolve: any, reject: any): void => {
            fs.unlink(path, (error: any) => FileUtils.handleResult(resolve, reject, error, void 0));
        });
    }
}
