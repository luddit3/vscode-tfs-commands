/**
 *  Included changes interface for files that have been edited and
 * checked out.
 *
 * @export
 * @interface IIncludedChanges
 */
export interface IIncludedChanges {
    fileName: string;
    action: string;
    filePath: string;
}
