import { Share, Alert } from 'react-native';

const APP_NAME = 'HYSA1';
const BASE_URL = 'https://hysa1.com';

export async function sharePost({ postId, username, text, url }) {
  const message = text
    ? `${text}\n\n— @${username} on ${APP_NAME}`
    : `Check out this post by @${username} on ${APP_NAME}`;

  try {
    const result = await Share.share({
      message,
      url: url || `${BASE_URL}/post/${postId}`,
      title: `${username} on ${APP_NAME}`,
    });
    return result;
  } catch (err) {
    if (err.message !== 'User did not share') {
      console.error('Share error:', err);
    }
    return null;
  }
}

export async function shareReel({ reelId, author, url }) {
  const message = `Check out this reel by @${author} on ${APP_NAME}`;

  try {
    const result = await Share.share({
      message,
      url: url || `${BASE_URL}/reel/${reelId}`,
      title: `Reel by @${author}`,
    });
    return result;
  } catch (err) {
    if (err.message !== 'User did not share') {
      console.error('Share error:', err);
    }
    return null;
  }
}

export async function shareProfile({ username, userKey, url }) {
  const message = `Check out @${username || userKey} on ${APP_NAME}`;

  try {
    const result = await Share.share({
      message,
      url: url || `${BASE_URL}/profile/${userKey}`,
      title: `${username || userKey}'s Profile`,
    });
    return result;
  } catch (err) {
    if (err.message !== 'User did not share') {
      console.error('Share error:', err);
    }
    return null;
  }
}

export async function copyLink(url, label = 'Link') {
  try {
    const result = await Share.share({
      message: url,
      title: `Copy ${label}`,
    });
    return result !== null;
  } catch (err) {
    if (err.message !== 'User did not share') {
      console.error('Share link error:', err);
    }
    Alert.alert(label, url);
    return false;
  }
}
