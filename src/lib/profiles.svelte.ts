// Links to members' profiles (D61), as the viewer may follow them. Someone waiting to be let in or
// suspended (D79) opens only their own; everyone else's name reads as plain text, since an <a> with
// no href isn't a link. The profile page refuses them too.
import { page } from '$app/state';

export function profileHref(userId: string): string | undefined {
	const groupId = page.params.groupId;
	const data = page.data as { profilesOpen?: boolean; myId?: string | null };
	if (!groupId || (data.profilesOpen === false && userId !== data.myId)) return undefined;
	return `/g/${groupId}/members/${userId}`;
}
