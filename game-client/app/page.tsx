import type { Metadata } from "next";
import HomeClient from "./home-client";

export const metadata: Metadata = {
  title: "Beananza — Play Now",
  description: "The unofficial Beananza card game",
};

export default function Page() {
  return <HomeClient />;
}
