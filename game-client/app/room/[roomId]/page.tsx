import type { Metadata } from "next";
import RoomPage from "./room-page";

export const metadata: Metadata = {
  title: "Beananza — Game Room",
  description: "Play Beananza with your friends",
};

export default function Page() {
  return <RoomPage />;
}
