export function getAvatar(userPicture: string | null, userEmail: string | null | undefined) {
    return userPicture ?? `https://avatar.vercel.sh/${userEmail ?? ''}`;
}