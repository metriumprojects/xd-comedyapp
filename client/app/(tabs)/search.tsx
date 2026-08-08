import { useLocalSearchParams } from 'expo-router';
import SearchModal from '../search-modal';

export default function SearchScreen() {
  const params = useLocalSearchParams();
  const initialQuery = (params.q || params.initialQuery || params.query || '') as string;
  return <SearchModal initialQuery={initialQuery} key={initialQuery || 'default'} />;
}
