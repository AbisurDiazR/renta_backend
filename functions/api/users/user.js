const express = require("express");
const admin = require("firebase-admin");
const firestore = require("../../lib/firebase");

const router = express.Router();

// Middleware to create a new user
router.post('/', async (req, res) => {
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
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ uid: userRecord.uid });
  } catch (error) {
    console.error("Error creating new user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Middleware to update a user
router.put('/:uid', async (req, res) => {
  const { uid } = req.params;
  const { name, email } = req.body;

  try {
    // Update the user in Firebase Authentication
    await admin.auth().updateUser(uid, {
      email,
    });

    // Update the user in Firestore
    await firestore.collection("users").doc(uid).update({
      name,
      email,
      disabled: false,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Middleware to disable a user
router.patch('/:uid', async (req, res) => {
  const { uid } = req.params;
  const { disabled } = req.body;

  if (typeof disabled !== "boolean") {
    return res.status(400).json({ error: "Invalid 'disabled' value. It must be a boolean." });
  }

  try {
    // Update the user's disabled status in Firebase Authentication
    await admin.auth().updateUser(uid, {
      disabled,
    });

    // Update the user's disabled status in Firestore
    await firestore.collection("users").doc(uid).update({
      disabled,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({ message: `User ${disabled ? "disabled" : "enabled"} successfully` });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

module.exports = router;