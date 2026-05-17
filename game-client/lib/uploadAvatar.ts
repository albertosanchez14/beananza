export async function uploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("avatar", file);
  const res = await fetch("/upload-avatar", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data: { url: string } = await res.json();
  return data.url;
}
