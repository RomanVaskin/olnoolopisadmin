import Dashboard from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default function Home() { return <Dashboard showTestIssue={process.env.NODE_ENV !== "production"} />; }
