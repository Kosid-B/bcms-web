import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProjectProfitApp from "../ProjectProfitApp.jsx";

describe("ProjectProfitApp", () => {
  it("renders the control tower shell, metrics, and placeholder section", () => {
    render(<ProjectProfitApp />);

    expect(
      screen.getByRole("heading", { name: "Project Profit Control Tower" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Executive Dashboard" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mobile Field Input" })
    ).toBeInTheDocument();

    const metricsSection = screen.getByRole("region", { name: "Key metrics" });
    expect(metricsSection).toBeInTheDocument();
    expect(
      within(metricsSection).getByText("Margin at Risk")
    ).toBeInTheDocument();
    expect(within(metricsSection).getByText("$184K")).toBeInTheDocument();
    expect(
      within(metricsSection).getByText("Field Updates Today")
    ).toBeInTheDocument();
    expect(within(metricsSection).getByText("27")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 2, name: "Workspace Ready" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Project Profit modules will land here as follow-on tasks.")
    ).toBeInTheDocument();
  });
});
