import { spawn, ChildProcess } from 'child_process';
import { TextDecoder } from 'util';
import { Changeset } from './models/changeset.model';

export class TfsCommands {
    private static readonly TFS_PATH_UNKNOWN: string = 'Unable to execute command. Path to TF.exe is unknown';
    private static readonly ARGS_NOT_SET_MESSAGE: string = 'Args to executeCommand method cannot be empty or null';

    private tfPath: string | undefined;
    constructor() {
        this.tfPath = this.getTfPath();
    }

    /**
     * Get the detailed TFS history of a file or folder
     *
     * @param {string} filePath
     * @param {number} count
     * @param {(changeSets: Changeset[]) => void} [onSuccess]
     * @param {((chunk: string | Buffer) => void)} [onStdError]
     * @param {(error: Error) => void} [onError]
     * @param {(code: number, signal: string) => void} [onExit]
     * @memberof TfsCommands
     */
    public getHistory(filePath: string, count: number,
                      onSuccess?: (changeSets: Changeset[]) => void,
                      onStdError?: (chunk: string | Buffer) => void,
                      onError?: (error: Error) => void,
                      onExit?: (code: number, signal: string) => void
    ): void {
        if (filePath) {
            const args: string[] = ['history', filePath, '/recursive', '/format:detailed', `/stopafter:${count.toString()}`];
            let changesetData: string = '';
            const stdout: (chunk: string | Buffer) => void = (chunk: string | Buffer): void => {
                if (chunk) {
                    const decoder: TextDecoder = new TextDecoder('utf-8');
                    const content: string = decoder.decode(chunk as Buffer);
                    changesetData += content;
                }
            };

            const stdErrorData: (chunk: string | Buffer) => void = (chunk: string | Buffer): void => {
                if (onStdError && chunk) {
                    onStdError(chunk);
                }
            };

            const exit: (code: number, signal: string) => void = (code: number, signal: string): void => {
                if (onExit) {
                    onExit(code, signal);
                }
            };

            const error: (error: Error) => void = (error: Error): void => {
                if (onError) {
                    onError(error);
                }
            };

            const close: (code: number, signal: string) => void = (code: number, signal: string): void => {
                const changesetSplit: string[] = changesetData.split('-------------------------------------------------------------------------------');
                changesetSplit.splice(0, 1);
                const changesets: Changeset[] = changesetSplit.map(s => new Changeset(s));
                if (onSuccess) {
                    onSuccess(changesets);
                }
            };

            this.executeTfsCommand(args, stdout, stdErrorData, error, exit, close);
        }
    }

    public getFile(filePath: string,
                   version: string,
                   onSuccess?: (file: string) => void,
                   onStdError?: (chunk: string | Buffer) => void
    ): void {
        if (filePath) {
            const initialArgs: string[] = ['view', filePath];
            if (version) {
                initialArgs.push(`/version:${version}`);
            }
            let data: string = '';
            const stdout: (chunk: string | Buffer) => void = (chunk: string | Buffer): void => {
                if (chunk) {
                    const decoder: TextDecoder = new TextDecoder('utf-8');
                    const content: string = decoder.decode(chunk as Buffer);
                    data += content;
                }
            };

            const close: (code: number, signal: string) => void = (code: number, signal: string): void => {
                if (onSuccess) {
                    onSuccess(data);
                }
            };


            this.executeTfsCommand(initialArgs, stdout, undefined, undefined, undefined, close);

        }
    }

    public getPreviousVersion(filePath: string, changesetId: number,
                              onSuccess?: (changeSets: Changeset[]) => void,
                              onStdError?: (chunk: string | Buffer) => void,
                              onError?: (error: Error) => void,
                              onExit?: (code: number, signal: string) => void
    ): void {
        if (filePath) {
            const args: string[] = ['history', filePath, '/format:detailed', `/v:${changesetId.toString()}`, '/stopafter:2'];
            let changesetData: string = '';
            const stdout: (chunk: string | Buffer) => void = (chunk: string | Buffer): void => {
                if (chunk) {
                    const decoder: TextDecoder = new TextDecoder('utf-8');
                    const content: string = decoder.decode(chunk as Buffer);
                    changesetData += content;
                }
            };

            const stdErrorData: (chunk: string | Buffer) => void = (chunk: string | Buffer): void => {
                const decoder: TextDecoder = new TextDecoder('utf-8');
                const content: string = decoder.decode(chunk as Buffer);
                console.log(content);
                if (onStdError && chunk) {
                    onStdError(chunk);
                }
            };

            const exit: (code: number, signal: string) => void = (code: number, signal: string): void => {
                if (onExit) {
                    onExit(code, signal);
                }
            };

            const error: (error: Error) => void = (error: Error): void => {
                if (onError) {
                    onError(error);
                }
            };

            const close: (code: number, signal: string) => void = (code: number, signal: string): void => {
                const changesetSplit: string[] = changesetData.split('-------------------------------------------------------------------------------');
                changesetSplit.splice(0, 1);
                const changesets: Changeset[] = changesetSplit.map(s => new Changeset(s));
                if (onSuccess) {
                    onSuccess(changesets);
                }
            };

            this.executeTfsCommand(args, stdout, stdErrorData, error, exit, close);
        }
    }

    public async checkoutFilePath(filePath: string,
                                  recursive: boolean,
                                  onSuccess?: (message: string) => void,
                                  onError?: (chunk: string | Buffer) => void
    ): Promise<void> {
        if (filePath) {
            const initialArgs: string[] = ['checkout', filePath];
            if (recursive) {
                initialArgs.push('/recursive');
            }
            const stdout: (chunk: string | Buffer) => void = (chunk: string | Buffer): void => {
                if (chunk) {
                    const decoder: TextDecoder = new TextDecoder('utf-8');
                    const content: string = decoder.decode(chunk as Buffer);
                    if (onSuccess) {
                        console.log('content');
                        onSuccess(content);
                    }
                }
            };

            const stdErrorData: (chunk: string | Buffer) => void = (chunk: string | Buffer): void => {
                if (onError && chunk) {
                    const decoder: TextDecoder = new TextDecoder('utf-8');
                    const content: string = decoder.decode(chunk as Buffer);
                    onError(content);
                }
            };


            this.executeTfsCommand(initialArgs, stdout, stdErrorData, undefined, undefined, undefined);
        }
    }

    /**
     * Get the path to TF.exe file that is used to run commands
     * TODO - based on system get the right file location
     *
     * @private
     * @returns {string}
     * @memberof TfsCommands
     */
    private getTfPath(): string {
        const tfPath: string = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Enterprise\\Common7\\IDE\\CommonExtensions\\Microsoft\\TeamFoundation\\Team Explorer\\TF.exe';
        return tfPath;
    }

    /**
     * Method for all other methods to use to execute TF commands
     * Uses the tfPath and an arguments string array to execuate commands with
     * child process and spawn
     *
     * @private
     * @param {string[]} args
     * @param {((chunk: string | Buffer) => void)} [onStdoutData]
     * @param {((chunk: string | Buffer) => void)} [onStdoutErrorData]
     * @param {(error: Error) => void} [onError]
     * @param {(code: number, signal: string) => void} [onExit]
     * @param {(code: number, signal: string) => void} [onClose]
     * @memberof TfsCommands
     */
    private executeTfsCommand(args: string[],
                              onStdoutData?: (chunk: string | Buffer) => void,
                              onStdoutErrorData?: (chunk: string | Buffer) => void,
                              onError?: (error: Error) => void,
                              onExit?: (code: number, signal: string) => void,
                              onClose?: (code: number, signal: string) => void): void {
        if (this.tfPath) {
            try {
                if (args && args.length > 0) {
                    const batch: ChildProcess = spawn(this.tfPath, args);
                    batch.stdout.on('data', (chunk: string | Buffer): void => {
                        if (onStdoutData && chunk) {
                            onStdoutData(chunk);
                        }
                    });

                    batch.stderr.on('data', (chunk: string | Buffer): void => {
                        if (onStdoutErrorData && chunk) {
                            onStdoutErrorData(chunk);
                        }
                    });

                    batch.on('error', (error: Error): void => {
                        if (onError && error) {
                            console.log(error.message);
                            onError(error);
                        }
                    });

                    batch.on('exit', (code: number, signal: string): void => {
                        if (onExit) {
                            onExit(code, signal);
                        }
                    });

                    batch.on('close', (code: number, signal: string): void => {
                        if (onClose) {
                            onClose(code, signal);
                        }
                    });

                } else {
                    throw new Error(TfsCommands.ARGS_NOT_SET_MESSAGE);
                }

            } catch (error) {

            }
        } else {
            throw new Error(TfsCommands.TFS_PATH_UNKNOWN);
        }
    }
}
