import {AboutSection} from "@/components/about_section";
import {Navbar} from "@/components/navbar";
import {Footer} from "@/components/footer";


export default function AboutPage() {
  return (
    <div className={'bg-gray-50'}>
      <Navbar/>
      <div className={'py-16 px-4 pb-24'}>
        <AboutSection/>
      </div>
      <Footer/>
    </div>
  )
}