document.addEventListener("DOMContentLoaded", () => {
  const revealItems = Array.from(document.querySelectorAll(".reveal"));
  const initialVisible = document.querySelectorAll(".screen-one .reveal");

  initialVisible.forEach((el) => el.classList.add("visible"));

  const pending = revealItems.filter((el) => !el.classList.contains("visible"));
  if (pending.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    pending.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.2
    }
  );

  pending.forEach((el) => observer.observe(el));
});
