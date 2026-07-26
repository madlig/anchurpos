import { redirect } from "next/navigation";

export default function EmployeesIndexPage() {
  redirect("/manager/employees/master");
}
