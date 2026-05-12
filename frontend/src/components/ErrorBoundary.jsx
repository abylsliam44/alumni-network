import { Component } from 'react';
import ErrorScreen from './ui/ErrorScreen';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          title="Что-то пошло не так"
          subtitle="Произошла неожиданная ошибка. Попробуйте обновить страницу."
          onRetry={() => {
            this.setState({ hasError: false });
            window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}
