import MenuList from "./components/MenuList";
import { SETTING_TABS } from "../utils/pageTitles";
import QuickActions from "./components/QuickActions";

/** 설정 탭의 첫 화면 — 셋 중 하나로 들어간다. */
export default function Settings() {
  return (
    <div className="page-wrap">
      <MenuList paths={SETTING_TABS} />

      <QuickActions />
    </div>
  );
}
