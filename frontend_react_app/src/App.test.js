import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app title and visualize button", () => {
  render(<App />);
  expect(screen.getByText(/JSON Toon Visualizer/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Visualize/i })).toBeInTheDocument();
});
