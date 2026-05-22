export async function uploadAvatar(
  file: File,
  authToken: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("avatar", file);
  const res = await fetch("/upload-avatar", {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}` },
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data: { url: string } = await res.json();
  return data.url;
}
