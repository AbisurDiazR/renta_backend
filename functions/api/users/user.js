const express = require("express");
const admin = require("firebase-admin");
const firestore = require("../../lib/firebase");

const router = express.Router();

// Middleware to create a new user
router.post("/", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    // Create a new record in the 'users' collection
    await firestore.collection("users").doc(userRecord.uid).set({
      name,
      email,
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: '',
    });

    res.status(201).json({ uid: userRecord.uid });
  } catch (error) {
    console.error("Error creating new user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Middleware to update user details
router.put("/:uid", async (req, res) => {
  const { uid } = req.params;
  const { name, email, password, disabled } = req.body;

  try {
    // Prepare the update payload for Firebase Authentication
    const authUpdatePayload = {};
    if (email) authUpdatePayload.email = email;
    if (password) authUpdatePayload.password = password;
    if (typeof disabled === "boolean") authUpdatePayload.disabled = disabled;

    // Update the user in Firebase Authentication if there are changes
    if (Object.keys(authUpdatePayload).length > 0) {
      if (authUpdatePayload.email) {
        // Check if the email is already in use
        const existingUser = await admin
          .auth()
          .getUserByEmail(authUpdatePayload.email)
          .catch(() => null);
        if (existingUser && existingUser.uid !== uid) {
          delete authUpdatePayload.email;
        }
      }
      await admin.auth().updateUser(uid, authUpdatePayload);
    }

    // Prepare the update payload for Firestore
    const firestoreUpdatePayload = {};
    if (name) firestoreUpdatePayload.name = name;
    if (email) firestoreUpdatePayload.email = email;
    if (typeof disabled === "boolean")
      firestoreUpdatePayload.disabled = disabled;
    if (Object.keys(firestoreUpdatePayload).length > 0) {
      if (firestoreUpdatePayload.email) {
        const existingUser = await admin
          .auth()
          .getUserByEmail(firestoreUpdatePayload.email)
          .catch(() => null);
        if (existingUser && existingUser.uid !== uid) {
          delete firestoreUpdatePayload.email;
        }
      }
      firestoreUpdatePayload.updatedAt = new Date().toISOString();
      await firestore
        .collection("users")
        .doc(uid)
        .update(firestoreUpdatePayload);
    }

    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

module.exports = router;
