/**
* Listen following changes and count
*
*/
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const db = admin.firestore();

export const followingWriteListener = functions.database
    .ref('followers/{followedUid}/{followerUid}')
    .onWrite(async (change, context) => {
        functions.logger.log("[**] Start");

        const followedUid = context.params.followedUid;

        functions.logger.log("Follower ", followedUid);

        const userDoc = db.doc(`users/${followedUid}`);

        // Get an object with the current document value.
        // If the document does not exist, it has been deleted.
        const document = change.after.exists() ? change.after.val() : null;
        if (document == null) {
            functions.logger.log("Deleting or disabled field..");
            await userDoc.update({ following: FieldValue.increment(-1) });
            functions.logger.log("[**] Done");
            return true;
        }

        // Get an object with the previous document value (for update or create)
        const oldDocument = change.before.val();
        if (document !== oldDocument) {
            if (document) {
                functions.logger.log("Updating.. value... ", document);
                await userDoc.update({ following: FieldValue.increment(1) });
            }
            if (!document) {
                functions.logger.log("Updating.. value... ", document);
                await userDoc.update({ following: FieldValue.increment(-1) });
            }
        }
        functions.logger.log("[**] Done");
        return true;
    });
