export default function TestPage() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#000',
      color: '#fff',
      fontSize: '24px'
    }}>
      <div>
        <h1>课程路由测试页面</h1>
        <p>如果你能看到这个页面，说明 /course/ 路由正常工作</p>
        <p>时间: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}



