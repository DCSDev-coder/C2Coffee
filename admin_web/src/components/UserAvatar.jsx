import React, { useState } from 'react';
import { getAdminApiBaseUrl } from '../lib/adminApi';

const LEGACY_PLACEHOLDER_FRAGMENT = 'images.unsplash.com/photo-1534528741775-53994a69daeb';
const PRESET_FILE_PATTERN = /(?:^|\/)(?:dato|datin|avatar[_-]?\d*)\.(?:png|jpe?g|webp|svg)$/i;

// oxlint-disable-next-line react/only-export-components
export const resolveUserAvatarUrl = (input, explicitAvatarType) => {
  const isObject = input !== null && typeof input === 'object';
  const rawValue = isObject
    ? (input.avatar ?? input.avatarUrl ?? input.avatar_value ?? '')
    : (input ?? '');
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!raw) return null;

  const avatarType = String(
    explicitAvatarType ?? (isObject ? (input.avatarType ?? input.avatar_type ?? '') : '')
  )
    .trim()
    .toLowerCase();

  if (avatarType === 'preset' || avatarType === 'default') return null;
  if (raw.includes(LEGACY_PLACEHOLDER_FRAGMENT)) return null;
  if (PRESET_FILE_PATTERN.test(raw)) return null;

  const isUploadedAvatar =
    avatarType === 'uploaded' ||
    raw.startsWith('/assets/avatars/') ||
    raw.startsWith('assets/avatars/') ||
    raw.startsWith('data:image/') ||
    raw.startsWith('blob:') ||
    /^https?:\/\//i.test(raw);

  if (!isUploadedAvatar) return null;

  if (/^(?:https?:|data:image\/|blob:)/i.test(raw)) {
    return raw;
  }

  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${getAdminApiBaseUrl()}${normalizedPath}`;
};

// oxlint-disable-next-line react/only-export-components
export const getUserInitial = (input, fallback = 'C') => {
  const isObject = input !== null && typeof input === 'object';
  const candidates = isObject
    ? [
        input.username,
        input.customer,
        input.name,
        input.full_name,
        input.fullName,
        input.displayName,
        input.display_name,
        input.employee,
        input.email,
      ]
    : [input];

  for (const candidate of candidates) {
    const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
    if (trimmed) {
      return trimmed.charAt(0).toUpperCase();
    }
  }
  return String(fallback || 'C').charAt(0).toUpperCase();
};

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  panel: 'w-11 h-11 text-sm',
  lg: 'h-14 w-14 text-xl',
  xl: 'h-16 w-16 text-xl',
};

const UserAvatar = ({
  user,
  name,
  avatar,
  avatarType,
  size = 'md',
  shape = 'circle',
  bgClass = 'bg-[#2E5E58]',
  className = '',
  fallback = 'C',
}) => {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const subject = user ?? { name, avatar, avatarType };
  const avatarUrl = resolveUserAvatarUrl(
    avatar !== undefined ? avatar : subject,
    avatarType !== undefined ? avatarType : undefined
  );
  const showImage = Boolean(avatarUrl) && failedAvatarUrl !== avatarUrl;
  const initial = getUserInitial(name !== undefined ? name : subject, fallback);
  const sizeClass = SIZE_CLASSES[size] || size;
  const radiusClass = shape === 'rounded' ? 'rounded-2xl' : 'rounded-full';
  const label =
    (typeof name === 'string' && name.trim()) ||
    user?.username ||
    user?.customer ||
    user?.name ||
    user?.full_name ||
    'User';

  if (showImage) {
    return (
      <img
        src={avatarUrl}
        alt={`${label} profile`}
        onError={() => setFailedAvatarUrl(avatarUrl)}
        className={`${sizeClass} ${radiusClass} shrink-0 object-cover shadow-2xs ring-1 ring-gray-200 ${className}`.trim()}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${radiusClass} ${bgClass} text-white flex items-center justify-center font-bold shrink-0 shadow-2xs ${className}`.trim()}
      aria-label={`${label} profile`}
    >
      {initial}
    </div>
  );
};

export default UserAvatar;
