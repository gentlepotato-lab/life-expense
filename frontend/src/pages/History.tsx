import PageHead from "./components/PageHead";
import MenuList from "./components/MenuList";
import { ENTRY_TABS } from "../utils/pageTitles";

/** 내역 탭의 첫 화면 — 셋 중 하나로 들어간다. */
export default function History() {
  return (
    <div className="page-wrap">
      <PageHead />
      <MenuList paths={ENTRY_TABS} />
    </div>
  );
}
