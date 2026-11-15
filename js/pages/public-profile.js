import { blockProfile, reportProfile } from '../core/profile-data.mjs';

function showActionStatus(root, message, isError = false) {
  const status = root.querySelector('[data-profile-action-status]');
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
  status.setAttribute('role', isError ? 'alert' : 'status');
}

function showShareStatus(dialog, message, isError = false) {
  const status = dialog.querySelector('[data-profile-share-status]');
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
  status.setAttribute('role', isError ? 'alert' : 'status');
}

function createShareDialog(root, profileUrl, profile) {
  const dialog = root.ownerDocument.createElement('dialog');
  dialog.className = 'profile-share-dialog clay';
  dialog.dataset.profileShareDialog = '';
  dialog.setAttribute('aria-labelledby', 'profile-share-title');
  dialog.innerHTML = `<div class="profile-share-dialog-head">
    <h2 id="profile-share-title">Share profile</h2>
    <button class="button button-secondary" type="button" data-profile-share-close aria-label="Close share dialog">Close</button>
  </div>
  <p>Scan the QR code or copy the link to open this profile.</p>
  <div class="profile-share-content">
    <div class="profile-share-qr" data-profile-qr></div>
    <div class="profile-share-link-panel">
      <p id="profile-share-link-label">Profile link</p>
      <a data-profile-share-link></a>
      <button class="button button-secondary" type="button" data-profile-copy>Copy link</button>
      <button class="button button-primary" type="button" data-profile-card-download>Download share card</button>
    </div>
  </div>
  <p class="form-message" data-profile-share-status role="status" hidden></p>`;
  const heading = dialog.querySelector('#profile-share-title');
  heading.textContent = `Share ${profile.nickname.trim() || 'Fisher learner'}'s profile`;
  const link = dialog.querySelector('[data-profile-share-link]');
  link.href = profileUrl;
  link.textContent = profileUrl;
  link.setAttribute('aria-labelledby', 'profile-share-link-label');
  root.append(dialog);
  return dialog;
}

export function bindPublicProfileActions({
  root,
  client,
  handle,
  profile,
  profileUrl,
  shareAllowed = true,
  isSignedIn,
  clipboard = globalThis.navigator?.clipboard,
  loadShareModule = () => import('../components/profile-share.js')
} = {}) {
  if (!root || typeof root.querySelector !== 'function') {
    throw new TypeError('A public profile element is required.');
  }
  const requireSignIn = (action) => {
    if (isSignedIn) return false;
    showActionStatus(root, `Sign in to ${action}.`);
    return true;
  };

  let shareModule;
  let shareDialog;
  root.querySelector('[data-profile-share]')?.addEventListener('click', async () => {
    if (!shareAllowed) {
      showActionStatus(root, 'This profile is private, so sharing is turned off.', true);
      return;
    }
    if (!profile) {
      showActionStatus(root, 'Profile sharing is unavailable.', true);
      return;
    }
    shareDialog ||= createShareDialog(root, profileUrl, profile);
    try {
      if (!shareModule) shareModule = await loadShareModule();
      shareModule.renderProfileQr({ target: shareDialog.querySelector('[data-profile-qr]'), url: profileUrl });
      if (!shareDialog.open) shareDialog.showModal();
    } catch (error) {
      console.error('Could not create the profile QR code.', error);
      showShareStatus(shareDialog, 'Could not create the QR code. You can still copy the profile link.', true);
      if (!shareDialog.open) shareDialog.showModal();
    }
  });

  root.addEventListener('click', async (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('[data-profile-share-close]')) {
      shareDialog?.close();
    } else if (target.closest('[data-profile-copy]')) {
      if (!clipboard?.writeText) {
        showShareStatus(shareDialog, `Copy this profile link: ${profileUrl}`);
        return;
      }
      try {
        await clipboard.writeText(profileUrl);
        showShareStatus(shareDialog, 'Profile link copied.');
      } catch (error) {
        console.error('Could not copy the profile link.', error);
        showShareStatus(shareDialog, 'Could not copy the profile link. Use the link shown above.', true);
      }
    } else if (target.closest('[data-profile-card-download]')) {
      try {
        if (!shareModule) shareModule = await loadShareModule();
        shareModule.downloadProfileCard({ profile, url: profileUrl });
        showShareStatus(shareDialog, 'Share card downloaded.');
      } catch (error) {
        console.error('Could not download the profile share card.', error);
        showShareStatus(shareDialog, error.message || 'Could not download the share card.', true);
      }
    }
  });

  root.querySelector('[data-profile-block]')?.addEventListener('click', async () => {
    if (requireSignIn('block this profile')) return;
    try {
      await blockProfile({ client, handle });
      showActionStatus(root, 'Profile blocked. You can unblock this learner from your profile settings.');
    } catch (error) {
      console.error('Could not block the profile.', error);
      showActionStatus(root, error.message || 'Could not block this profile.', true);
    }
  });

  root.querySelector('[data-profile-report]')?.addEventListener('click', () => {
    if (requireSignIn('report this profile')) return;
    const form = root.querySelector('[data-profile-report-form]');
    if (form) form.hidden = false;
  });

  root.querySelector('[data-profile-report-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (requireSignIn('report this profile')) return;
    const reason = event.currentTarget.elements.reason.value;
    try {
      await reportProfile({ client, handle, reason });
      event.currentTarget.hidden = true;
      showActionStatus(root, 'Report submitted. Thank you for helping keep profiles safe.');
    } catch (error) {
      console.error('Could not report the profile.', error);
      showActionStatus(root, error.message || 'Could not submit this report.', true);
    }
  });
}
