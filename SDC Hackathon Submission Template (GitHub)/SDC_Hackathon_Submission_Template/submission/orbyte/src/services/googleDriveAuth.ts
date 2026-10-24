/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { InvoiceDraft } from '../types';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];

// Initialize Firebase App instance safely without duplicates
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Memory-only access token caching (MANDATORY: NEVER stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  description?: string;
}

/**
 * Initialize Auth listener. Keeps cachedAccessToken in memory only.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If user is logged in via Firebase but token is missing from memory,
        // we prompt for credential re-acquire when user clicks Drive actions.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google using popup and obtain Google Drive OAuth access token
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token from authentication.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sign out and clear in-memory token
 */
export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/* =========================================================================
   Google Drive API Client Methods
   ========================================================================= */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
export const DEFAULT_FOLDER_NAME = 'Orbyte InvoisReady — eInvoices & Compliance';

/**
 * Find or create dedicated folder in Google Drive
 */
export const findOrCreateDriveFolder = async (
  folderName: string = DEFAULT_FOLDER_NAME
): Promise<string> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Google Drive access token not available. Please sign in with Google.');

  // Search for folder created by this app
  const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`);
  const searchRes = await fetch(`${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to search Google Drive folders (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder if not found
  const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Directory for verified Malaysian SME e-Invoices and statutory compliance records created by Orbyte InvoisReady.',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create folder in Google Drive (${createRes.status})`);
  }

  const folderData = await createRes.json();
  return folderData.id;
};

/**
 * List files created in the application's Drive or specific folder
 */
export const listDriveFiles = async (folderId?: string): Promise<DriveFileItem[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Google Drive access token not available. Please sign in with Google.');

  let q = "trashed=false and mimeType != 'application/vnd.google-apps.folder'";
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }

  const fields = 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,description)';
  const res = await fetch(`${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&orderBy=modifiedTime desc&pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to list files from Google Drive (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
};

/**
 * Upload a file (Blob or string) to Google Drive using multipart upload
 */
export const uploadFileToDrive = async ({
  name,
  mimeType,
  content,
  folderId,
  description,
}: {
  name: string;
  mimeType: string;
  content: Blob | string;
  folderId?: string;
  description?: string;
}): Promise<DriveFileItem> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Google Drive access token not available. Please sign in with Google.');

  const metadata: any = {
    name,
    mimeType,
  };
  if (folderId) metadata.parents = [folderId];
  if (description) metadata.description = description;

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let contentBlob: Blob;
  if (typeof content === 'string') {
    contentBlob = new Blob([content], { type: mimeType });
  } else {
    contentBlob = content;
  }

  const metadataBlob = new Blob(
    [
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${mimeType}\r\n\r\n`,
    ],
    { type: 'text/plain' }
  );

  const endBlob = new Blob([closeDelimiter], { type: 'text/plain' });
  const multipartBlob = new Blob([metadataBlob, contentBlob, endBlob], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await fetch(
    `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,description`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBlob,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to upload file to Google Drive (${res.status})`);
  }

  return await res.json();
};

/**
 * Delete a file in Google Drive (must be accompanied by explicit confirmation UI)
 */
export const deleteDriveFile = async (fileId: string): Promise<void> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Google Drive access token not available. Please sign in with Google.');

  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to delete file from Google Drive (${res.status})`);
  }
};

/**
 * Read/Download file content from Google Drive
 */
export const downloadDriveFileText = async (fileId: string): Promise<string> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Google Drive access token not available. Please sign in with Google.');

  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to download file from Google Drive (${res.status})`);
  }

  return await res.text();
};
