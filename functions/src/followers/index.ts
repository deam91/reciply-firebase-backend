/**
 * Send notification to the followed
 *
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {DataSnapshot} from "firebase-admin/database";
import { FieldValue } from "firebase-admin/firestore";

admin.initializeApp();
const db = admin.firestore();

export const sendFollowerNotification = functions.database
    .ref("/followers/{followedUid}/{followerUid}")
    .onWrite(async (change, context) => {
      const followerUid = context.params.followerUid;
      const followedUid = context.params.followedUid;
      console.log(followerUid);
      console.log(followedUid);
      if (!change.after.val()) {
        return functions.logger.log(
            "User ",
            followerUid,
            "un-followed user",
            followedUid
        );
      }
      functions.logger.log(
          "We have a new follower UID:",
          followerUid,
          "for user:",
          followedUid
      );
      // Get the list of device notification tokens.
      const getDeviceTokensPromise = admin.database()
          .ref(`/users/${followedUid}/notificationTokens`).once("value");

      // Get the follower profile.
      const getFollowerProfilePromise = admin.auth().getUser(followerUid);

      // Get an object with the current document value.
      // If the document does not exist, it has been deleted.
      const userDoc = db.doc(`users/${followedUid}`);
      const document = change.after.exists() ? change.after.val() : null;
      const oldDocument = change.before.val();
      
      let updateUserPromise: any;
      if (document == null) {
          functions.logger.log("Deleting or disabled field..");
          updateUserPromise = userDoc.update({ following: FieldValue.increment(-1) });
          functions.logger.log("[**] Done");
      } else 
      // Get an object with the previous document value (for update or create)
      if (document !== oldDocument) {
          if (document) {
              functions.logger.log("Updating.. value... ", document);
              updateUserPromise = userDoc.update({ following: FieldValue.increment(1) });
          }
          if (!document) {
              functions.logger.log("Updating.. value... ", document);
              updateUserPromise = userDoc.update({ following: FieldValue.increment(-1) });
          }
      }

      // The snapshot to the user's tokens.
      let tokensSnapshot: DataSnapshot;

      // The array containing all the user's tokens.
      let tokens: string | any[];

      const results = await Promise.all([getDeviceTokensPromise, getFollowerProfilePromise, updateUserPromise]);
      tokensSnapshot = results[0];
      const follower = results[1];

      // Check if there are any device tokens.
      if (!tokensSnapshot.hasChildren()) {
        return functions.logger.log(
            "There are no notification tokens to send to."
        );
      }
      functions.logger.log(
          "There are",
          tokensSnapshot.numChildren(),
          "tokens to send notifications to."
      );
      functions.logger.log("Fetched follower profile", follower);

      // Notification details.
      const payload = {
        notification: {
          title: "You have a new follower!",
          body: `${follower.displayName} is now following you.`,
          icon: follower.photoURL,
        },
      };

      // Listing all tokens as an array.
      tokens = Object.keys(tokensSnapshot.val());
      // Send notifications to all tokens.
      const response = await admin.messaging().sendToDevice(tokens, payload);
      // For each message check if there was an error.
      const tokensToRemove: any[] = [];

      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          functions.logger.error(
              "Failure sending notification to",
              tokens[index],
              error
          );
          // Cleanup the tokens who are not registered anymore.
          if (error.code === "messaging/invalid-registration-token" ||
          error.code === "messaging/registration-token-not-registered") {
            tokensToRemove.push(tokensSnapshot.ref.child(tokens[index]).remove());
          }
        }
      });
      return Promise.all(tokensToRemove);
    });
