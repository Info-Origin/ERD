import { Header } from "./Header";
import { ResizablePanels } from "./ResizablePanels";
import styles from "../../styles/layout.module.css";

export const AppLayout = ({ children }) => {
  return (
    <div className={styles.appLayout}>
      <Header />
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
};
