import DocsClient from "./DocsClient";

export const metadata = {
  title: "API Documentation — Sky Style",
  description: "Official Sky Style API reference: authentication, endpoints, request/response examples, and error codes.",
};

export default function DocsPage() {
  return <DocsClient />;
}
