export default function StatusPage() {
  return (
    <div style={{padding:"2rem",fontFamily:"sans-serif",background:"#111",color:"#fff",minHeight:"100vh"}}>
      <h1 style={{color:"#f97316",marginBottom:"1.5rem"}}>작업 완료 현황</h1>
      <div style={{background:"#1e1e1e",borderRadius:"12px",padding:"1.5rem",marginBottom:"1rem"}}>
        <h2 style={{color:"#22c55e",marginBottom:"1rem"}}>완료된 작업</h2>
        <ul style={{lineHeight:"2",color:"#ccc"}}>
          <li>낚시단 기능 구현 (생성/목록/상세/관리)</li>
          <li>AppHeader.tsx 빌드 에러 수정</li>
          <li>로고 수정 (입 글자 흰색, 오렌지 유지 - logo-ipnak-dark.png)</li>
          <li>알림 기능 확장, 관리자 낚시단 관리</li>
        </ul>
      </div>
      <div style={{background:"#1e1e1e",borderRadius:"12px",padding:"1.5rem"}}>
        <h2 style={{color:"#f97316",marginBottom:"1rem"}}>수동 실행 필요</h2>
        <p style={{color:"#aaa",marginBottom:"0.5rem"}}>터미널에서:</p>
        <pre style={{background:"#000",padding:"1rem",borderRadius:"8px",color:"#4ade80",overflow:"auto"}}>npx prisma generate</pre>
      </div>
    </div>
  );
}
