export const getUserAvatarUrl = (user) => {
  if (!user || typeof user !== "object") return "";

  const candidates = [
    user.profilePicture,
    user.profileImage,
    user.photoURL,
    user.photoUrl,
    user.profileUrl,
    user.avatar,
    user.avatarUrl,
    user.avatarURL,
    user.image,
    user.photo,
    user.merchantProfile?.logo,
  ];

  const firstValid = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );

  return firstValid?.trim() || "";
};

export const getUserAvatarInitial = (user, fallback = "U") => {
  const label = [
    user?.name,
    user?.fullName,
    user?.displayName,
    user?.username,
    user?.email,
  ].find((value) => typeof value === "string" && value.trim());

  return String(label || fallback).trim().charAt(0).toUpperCase();
};
