import * as os from 'os';

export interface IChangesetItem {
    type: string;
    path: string;
}

export class Changeset {

    public id: number = -1;
    public user: string = '';
    public date: string = '';
    public comments: string = '';
    public items: IChangesetItem[] = [];

    public stringData: string = '';

    constructor(changesetData: string) {
        // Deep copy the string
        this.stringData = (` ${changesetData}`).slice(1);
        this.setChangesetValues(changesetData);
    }

    public toString(): string {
        return this.stringData;
    }

    private setChangesetValues(changesetData: string): void {
        // console.log(changesetData);
        // Split up changeset string data into array of string by new lines
        const changesetSplit: string[] = changesetData.split(os.EOL);
        // Remove extraneous first element
        changesetSplit.splice(0, 1);

        // Set the changeset ID
        const idIndexStart: number = 11;
        this.id = parseInt(changesetSplit.splice(0, 1)[0].substring(idIndexStart), 10);

        // Set the user name that submitted the changeset
        const userIndexStart: number = 6;
        this.user = changesetSplit.splice(0, 1)[0].substring(userIndexStart);

        // Set the Date
        this.date = changesetSplit.splice(0, 1)[0].substring(userIndexStart);
        changesetSplit.splice(0, 2);

        // Get all the comments and piece them back together in readable form
        let commentsData: string[] = [];
        let commentRemoveCount: number = 0;
        for (let i: number = 0; i < changesetSplit.length; i++) {
            if (changesetSplit[i].startsWith('  ')) {
                commentsData.push(changesetSplit[i]);
                commentRemoveCount++;
            } else {
                break;
            }
        }
        changesetSplit.splice(0, commentRemoveCount + 2);
        commentsData = commentsData.map(s => s.trimLeft());
        this.comments = commentsData.join(os.EOL);

        // Get all the items that were submitted as part of the changeset
        let items: string[] = [];
        let itemsRemoveCount: number = 0;
        for (let i: number = 0; i < changesetSplit.length; i++) {
            if (changesetSplit[i].startsWith('  ')) {
                items.push(changesetSplit[i]);
                itemsRemoveCount++;
            } else {
                break;
            }
        }
        changesetSplit.splice(0, itemsRemoveCount + 2);

        // Set all the items that were checked in with the changeset
        items = items.map(s => s.trimLeft());
        for (let i: number = 0; i < items.length; i++) {
            const item: string = items[i];
            const dollarSignIndex: number = item.indexOf('$');
            const path: string = item.substring(dollarSignIndex);
            const type: string = item.substring(0, dollarSignIndex);
            const changesetItem: IChangesetItem = {
                type: type.trim(),
                path: path ? path : ''
            };
            this.items.push(changesetItem);
        }

    }

}
