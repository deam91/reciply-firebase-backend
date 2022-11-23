/**
 * Get favorite recipes by user
 *
 */
import * as functions from "firebase-functions";
import * as firestore from "firebase-admin/firestore";

const db = firestore.getFirestore();

function sliceIntoChunks(arr: any, chunkSize: number) {
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    res.push(chunk);
  }
  return res;
}

export const userFavoriteRecipes = functions
// .runWith({
//   enforceAppCheck: true  // Requests without valid App Check tokens will be rejected.
// })
.https.onCall(async (data, context) => {
  // if (context.app == undefined) {
  //   throw new functions.https.HttpsError(
  //       'failed-precondition',
  //       'The function must be called from an App Check verified app.')
  // }

  const bookmarks = data.bookmarks as Array<String>;
  let recipesList: any[] = [];
  if (bookmarks) {
    const processConcurrently = sliceIntoChunks(bookmarks, 10).map(async (recipeIds) => {
      const recipes = await db.collection("recipes")
          .where(firestore.FieldPath.documentId(), "in", recipeIds)
          .get();
      functions.logger.log("[**] We got ", recipes.docs.length, " docs");
      if (!recipes.empty) {
        for (const recipe of recipes.docs) {
          let data = JSON.parse(JSON.stringify(recipe.data()));
          data['id'] = recipe.id;
          recipesList.push(data);
        }
      }
    });
    await Promise.all(processConcurrently);
  }
  functions.logger.log("[**] We got a list with ", recipesList.length, " elements");
  return recipesList;
});


